import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export function createDatabase(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 3_000,
    query_timeout: 3_000,
    max: 5,
  });
  return new PrismaClient({ adapter });
}
