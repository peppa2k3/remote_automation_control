import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomUUID } from 'node:crypto';
import { loginInputSchema } from '@automation/contracts';
import { createDatabase } from '../../database.js';
import { hashPassword } from './crypto.js';
import { readHiddenPassword } from './bootstrap-cli.js';

async function main() {
  if (process.argv.length !== 2 || !stdin.isTTY || !stdout.isTTY || !process.env.DATABASE_URL)
    throw new Error('TTY_AND_DATABASE_REQUIRED');
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = (await terminal.question('Email tài khoản mới: ')).trim();
  terminal.close();
  const password = await readHiddenPassword('Mật khẩu (ẩn, tối thiểu 12 ký tự): ');
  if (password.length < 12 || password !== (await readHiddenPassword('Nhập lại mật khẩu: ')))
    throw new Error('PASSWORD_INVALID');
  const input = loginInputSchema.parse({ email, password });
  const db = createDatabase(process.env.DATABASE_URL);
  try {
    const passwordHash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, passwordHash, role: 'VIEWER' },
      });
      await tx.auditLog.create({
        data: { action: 'user.created.cli', targetId: user.id, requestId: randomUUID() },
      });
    });
    stdout.write(
      'Đã tạo tài khoản. Chủ thiết bị có thể chia sẻ quyền qua email này tại /devices.\n',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Không tạo được tài khoản. Kiểm tra DB, email chưa tồn tại, mật khẩu xác nhận và terminal tương tác.',
  );
  process.exitCode = 1;
});
