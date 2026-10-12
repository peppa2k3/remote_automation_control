import 'dotenv/config';
import pino from 'pino';
import { createApp } from './app.js';
import { parseConfig } from './config.js';
import { createDatabase } from './database.js';

const parsed = (() => {
  try {
    return parseConfig(process.env);
  } catch {
    console.error('Cấu hình backend không hợp lệ. Kiểm tra .env theo .env.example.');
    process.exit(1);
  }
})();
const logger = pino({ level: parsed.LOG_LEVEL });
const db = parsed.DATABASE_URL ? createDatabase(parsed.DATABASE_URL) : undefined;
const app = createApp({
  frontendOrigin: parsed.FRONTEND_ORIGIN,
  checkDatabase: async () => {
    if (!db) throw new Error('Database is not configured');
    await db.$queryRaw`SELECT 1`;
  },
  log: (record) => logger.info(record, 'request completed'),
});
const server = app.listen(parsed.PORT, parsed.HOST, () =>
  logger.info({ port: parsed.PORT }, 'backend started'),
);
server.on('error', () => {
  logger.error('Backend không thể mở cổng.');
  process.exit(1);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timer = setTimeout(() => process.exit(1), 10_000);
  timer.unref();
  server.close(async () => {
    await db?.$disconnect();
    clearTimeout(timer);
    process.exit(0);
  });
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
