import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createDatabase } from '../../database.js';
import { createAuthStore } from './store.js';
import { bootstrapOwner } from './service.js';
import { AuthError } from './types.js';

export function readHiddenPassword(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) return Promise.reject(new Error('TTY_REQUIRED'));
  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    let overflow = false;
    function cleanup() {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    }
    function onData(chunk: Buffer) {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('CANCELED'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          if (overflow || new TextEncoder().encode(value).byteLength > 128)
            reject(new Error('PASSWORD_LIMIT'));
          else resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') value = Array.from(value).slice(0, -1).join('');
        else if (char >= ' ') {
          if (value.length < 256) value += char;
          else overflow = true;
        }
      }
    }
    stdin.on('data', onData);
  });
}
async function main() {
  if (process.argv.length !== 2 || !stdin.isTTY || !stdout.isTTY) throw new Error('TTY_REQUIRED');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_REQUIRED');
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = await terminal.question('Email owner: ');
  terminal.close();
  const password = await readHiddenPassword('Mật khẩu (ẩn, tối thiểu 12 ký tự): ');
  if (password !== (await readHiddenPassword('Nhập lại mật khẩu (ẩn): ')))
    throw new Error('PASSWORD_MISMATCH');
  const db = createDatabase(process.env.DATABASE_URL);
  try {
    await bootstrapOwner(createAuthStore(db), email.trim(), password);
    stdout.write('Owner đã được tạo. Mật khẩu không được ghi vào log.\n');
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof AuthError
      ? error.message
      : 'Bootstrap không thành công. Cần TTY tương tác, DATABASE_URL hợp lệ và mật khẩu xác nhận trùng nhau.',
  );
  process.exitCode = 1;
});
