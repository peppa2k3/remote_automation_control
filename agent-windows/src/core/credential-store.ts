import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join, isAbsolute } from 'node:path';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { deviceIdentitySchema, deviceTokenSchema } from '@automation/contracts';

export const credentialSchema = z
  .object({
    version: z.literal(1),
    apiBaseUrl: z.url(),
    identity: deviceIdentitySchema,
    token: deviceTokenSchema,
    pendingToken: deviceTokenSchema.optional(),
  })
  .strict();
export type LocalCredential = z.infer<typeof credentialSchema>;
export interface CredentialStore {
  load(): Promise<LocalCredential | null>;
  save(value: LocalCredential): Promise<void>;
}
const script = `
$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Security
  $data = [Console]::In.ReadToEnd() | ConvertFrom-Json
  if ($data.operation -eq 'secure') {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
    foreach ($identity in @($sid, (New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
      $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', $inherit, 'None', 'Allow')
      $acl.AddAccessRule($rule)
    }
    [IO.Directory]::SetAccessControl($data.path, $acl)
    [Console]::Out.Write('OK')
  } else {
    $bytes = [Convert]::FromBase64String($data.value)
    $entropy = [Text.Encoding]::UTF8.GetBytes('automation.device.dpapi.v1')
    $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
    if ($data.operation -eq 'protect') { $result = [Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, $scope) }
    elseif ($data.operation -eq 'unprotect') { $result = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, $scope) }
    else { throw 'INVALID_OPERATION' }
    [Console]::Out.Write([Convert]::ToBase64String($result))
  }
} catch { exit 1 }
`;
const lockScript = `
$ErrorActionPreference = 'Stop'
try {
  $data = [Console]::In.ReadLine() | ConvertFrom-Json
  $handle = New-Object IO.FileStream($data.path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  [Console]::Out.WriteLine('LOCKED')
  [Console]::In.ReadToEnd() | Out-Null
  $handle.Dispose()
} catch { exit 1 }
`;
function helper(source: string) {
  if (process.platform !== 'win32' || !process.env.SystemRoot)
    throw new Error('WINDOWS_DPAPI_REQUIRED');
  return spawn(
    join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(source, 'utf16le').toString('base64'),
    ],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
async function native(data: Record<string, string>) {
  const child = helper(script);
  return new Promise<string>((resolve, reject) => {
    let output = '',
      failed = false;
    const timeout = setTimeout(() => {
      failed = true;
      child.kill();
    }, 15_000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.length > 32_768) {
        failed = true;
        child.kill();
      }
    });
    child.stderr.resume(); // Native error details may contain sensitive data; never log them.
    child.on('error', () => {
      failed = true;
    });
    child.stdin.on('error', () => {
      failed = true;
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (failed || code !== 0) reject(new Error('DPAPI_FAILED'));
      else resolve(output.trim());
    });
    child.stdin.end(JSON.stringify(data));
  });
}
export class DpapiCredentialStore implements CredentialStore {
  readonly directory: string;
  readonly file: string;
  constructor(stateDirectory: string) {
    if (!isAbsolute(stateDirectory)) throw new Error('ABSOLUTE_STATE_DIRECTORY_REQUIRED');
    this.directory = join(stateDirectory, 'device-identity');
    this.file = join(this.directory, 'credential.dpapi');
  }
  async initialize() {
    await mkdir(this.directory, { recursive: true });
    if ((await lstat(this.directory)).isSymbolicLink()) throw new Error('REPARSE_STORE_REJECTED');
    await native({ operation: 'secure', path: this.directory });
  }
  async exclusive<T>(work: () => Promise<T>): Promise<T> {
    await this.initialize();
    const child: ChildProcessWithoutNullStreams = helper(lockScript);
    // FileShare.None is an OS lock, released even after a crash/EOF; no stale PID lock files.
    let acquired = false;
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error('STORE_BUSY'));
        }, 10_000);
        child.stdout.once('data', (chunk: Buffer) => {
          clearTimeout(timeout);
          if (chunk.toString('utf8').trim() !== 'LOCKED') {
            child.kill();
            reject(new Error('STORE_BUSY'));
          } else {
            acquired = true;
            resolve();
          }
        });
        child.on('error', () => {
          clearTimeout(timeout);
          reject(new Error('STORE_BUSY'));
        });
        child.once('close', () => {
          clearTimeout(timeout);
          if (!acquired) reject(new Error('STORE_BUSY'));
        });
        child.stderr.resume();
        child.stdin.on('error', () => reject(new Error('STORE_BUSY')));
        child.stdin.write(`${JSON.stringify({ path: join(this.directory, 'agent.lock') })}\n`);
      });
      return await work();
    } finally {
      child.stdin.end();
      const timeout = setTimeout(() => child.kill(), 5_000);
      await closed;
      clearTimeout(timeout);
    }
  }
  async load(): Promise<LocalCredential | null> {
    try {
      const stat = await lstat(this.file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16_384)
        throw new Error('INVALID_CREDENTIAL_FILE');
      const ciphertext = await readFile(this.file, 'utf8');
      if (!/^[A-Za-z0-9+/=]+$/.test(ciphertext)) throw new Error('INVALID_CREDENTIAL_FILE');
      const encoded = await native({ operation: 'unprotect', value: ciphertext });
      return credentialSchema.parse(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')
        return null;
      throw new Error('CREDENTIAL_UNAVAILABLE', { cause: error });
    }
  }
  async save(value: LocalCredential) {
    const encoded = Buffer.from(JSON.stringify(credentialSchema.parse(value)), 'utf8').toString(
      'base64',
    );
    const ciphertext = await native({ operation: 'protect', value: encoded });
    const temp = join(this.directory, `${randomUUID()}.tmp`);
    try {
      const handle = await open(temp, 'wx', 0o600);
      try {
        await handle.writeFile(ciphertext, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temp, this.file);
    } finally {
      await unlink(temp).catch(() => {});
    }
  }
}
