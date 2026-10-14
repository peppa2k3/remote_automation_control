import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { join } from 'node:path';
import { arch } from 'node:os';
import { StringDecoder } from 'node:string_decoder';
import { agentMetadataSchema, pairInputSchema } from '@automation/contracts';
import { parseAgentConfig } from '../config.js';
import { DpapiCredentialStore } from './credential-store.js';
import { HttpDeviceClient } from './client.js';
import { rotateCredential, runHeartbeat } from './connection.js';
import { runtimeSnapshot } from './runtime.js';

async function hiddenCode() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('TTY_REQUIRED');
  stdout.write('Mã ghép đôi (nhập ẩn): ');
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise<string>((resolve, reject) => {
    let value = '',
      overflow = false;
    const decoder = new StringDecoder('utf8');
    function cleanup() {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    }
    function onData(chunk: Buffer) {
      for (const char of decoder.write(chunk)) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('CANCELED'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          if (overflow) reject(new Error('INVALID_CODE'));
          else resolve(value.trim());
          return;
        }
        if (char === '\b' || char === '\u007f') value = value.slice(0, -1);
        else if (char >= ' ') {
          if (value.length < 96) value += char;
          else overflow = true;
        }
      }
    }
    stdin.on('data', onData);
  });
}
async function main() {
  const command = process.argv[2];
  if (
    process.argv.length !== 3 ||
    !['pair', 'run', 'rotate', 'heartbeat'].includes(command ?? '') ||
    process.platform !== 'win32'
  )
    throw new Error('INVALID_COMMAND');
  const config = parseAgentConfig(process.env);
  const base = config.AGENT_API_BASE_URL.replace(/\/$/, '');
  const directory =
    config.AGENT_STATE_DIR ??
    (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'AutomationControl') : undefined);
  if (!directory) throw new Error('STATE_DIRECTORY_REQUIRED');
  const store = new DpapiCredentialStore(directory),
    client = new HttpDeviceClient(config);
  const metadata = agentMetadataSchema.parse({
    platform: process.platform,
    arch: arch(),
    version: '0.1.0',
    capabilities: ['diagnostics', 'heartbeat'],
  });
  await store.exclusive(async () => {
    let current = await store.load();
    if (command === 'pair') {
      if (current) throw new Error('ALREADY_PAIRED');
      if (!stdin.isTTY || !stdout.isTTY) throw new Error('TTY_REQUIRED');
      const terminal = createInterface({ input: stdin, output: stdout });
      stdout.write(`Máy này sẽ kết nối tới: ${base}\n`);
      const consent = await terminal.question('Đây là server của bạn? Nhập YES để tiếp tục: ');
      if (consent !== 'YES') {
        terminal.close();
        throw new Error('CONSENT_REQUIRED');
      }
      const label = await terminal.question('Tên thiết bị: ');
      terminal.close();
      const input = pairInputSchema.parse({ ...metadata, label, code: await hiddenCode() });
      const paired = await client.pair(input); // No automatic retry of a one-use pairing code.
      const { token, ...identity } = paired;
      await store.save({ version: 1, apiBaseUrl: base, token, identity });
      console.log(JSON.stringify({ event: 'agent.paired', deviceId: identity.deviceId }));
      return;
    }
    if (!current || current.apiBaseUrl !== base) throw new Error('PAIRING_REQUIRED');
    if (command === 'rotate' || current.pendingToken) {
      current = await rotateCredential(store, client, current);
      console.log(JSON.stringify({ event: 'agent.rotated', deviceId: current.identity.deviceId }));
    }
    if (command === 'rotate') return;
    if (command === 'heartbeat') {
      const heartbeat = await client.heartbeat(current.token, {
        ...metadata,
        runtime: runtimeSnapshot(),
      });
      if (heartbeat.deviceId !== current.identity.deviceId) throw new Error('DEVICE_ID_MISMATCH');
      console.log(JSON.stringify({ event: 'agent.heartbeat', deviceId: heartbeat.deviceId }));
      return;
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
      await runHeartbeat(store, client, metadata, {
        signal: controller.signal,
        log: (event) => console.log(JSON.stringify(event)),
      });
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  });
}
main().catch(() => {
  console.error(
    JSON.stringify({
      event: 'agent.failed',
      message:
        'Không thể thực hiện. Kiểm tra kết nối, kho DPAPI và trạng thái thiết bị. Pair cần TTY, không nhận mã/token qua argument hoặc env. Nếu pair đã dùng mã nhưng lưu thất bại, owner phải thu hồi thiết bị trước khi ghép lại.',
    }),
  );
  process.exitCode = 1;
});
