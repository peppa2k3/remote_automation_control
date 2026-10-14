import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const [domain, email, ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !domain ||
  !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) ||
  !email ||
  !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/.test(email)
) {
  console.error('Cách dùng tại root: node scripts/setup-vps.mjs <domain-không-https> <email-ACME>');
  process.exitCode = 1;
} else {
  try {
    await writeFile(
      'infrastructure/vps/.env',
      `PUBLIC_DOMAIN=${domain}\nACME_EMAIL=${email}\nPOSTGRES_USER=automation\nPOSTGRES_DB=automation\nPOSTGRES_PASSWORD=${randomBytes(24).toString('hex')}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    console.log(
      'Đã tạo infrastructure/vps/.env. Không in secret. Tiếp tục theo docs/guides/vps-setup.md.',
    );
  } catch (error) {
    if (error.code === 'EEXIST') console.log('Giữ nguyên file VPS .env đã có.');
    else throw error;
  }
}
