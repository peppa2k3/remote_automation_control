import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { AuthError } from './types.js';

let active = 0;
const waiting: (() => void)[] = [];
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (active >= 2) {
    if (waiting.length >= 10)
      throw new AuthError(429, 'AUTH_BUSY', 'Hệ thống đang bận, hãy thử lại sau.');
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$32768$8$3$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const match = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(hash);
  if (!match?.[1] || !match[2]) return false;
  return timingSafeEqual(
    await derive(password, Buffer.from(match[1], 'hex')),
    Buffer.from(match[2], 'hex'),
  );
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function tokenHash(token: string) {
  return digest(`automation.session.v1:${token}`);
}
export function csrfToken(token: string) {
  return createHmac('sha256', token).update('automation.csrf.v1').digest('base64url');
}
export function equalCsrf(actual: string | undefined, expected: string) {
  return (
    !!actual &&
    /^[A-Za-z0-9_-]{43}$/.test(actual) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  );
}
export function newToken() {
  return randomBytes(32).toString('hex');
}
