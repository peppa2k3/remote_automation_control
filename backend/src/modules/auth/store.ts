import type { PrismaClient } from '../../generated/prisma/client.js';
import type { AuthStore } from './types.js';

export function createAuthStore(db: PrismaClient): AuthStore {
  return {
    findUser: (email) => db.user.findUnique({ where: { email } }),
    findSession: (tokenHash) =>
      db.authSession.findUnique({ where: { tokenHash }, include: { user: true } }),
    consumeAttempts: (keys, now, windowSeconds) =>
      db.$transaction(async (tx) => {
        const sorted = [...keys].sort((a, b) => a.key.localeCompare(b.key));
        for (const { key } of sorted)
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        const records = await tx.authThrottle.findMany({
          where: { key: { in: sorted.map((item) => item.key) } },
        });
        if (
          sorted.some((item) =>
            records.some(
              (row) => row.key === item.key && row.resetAt > now && row.count >= item.limit,
            ),
          )
        )
          return false;
        for (const { key } of sorted) {
          const current = records.find((row) => row.key === key);
          await tx.authThrottle.upsert({
            where: { key },
            create: { key, count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) },
            update:
              current && current.resetAt > now
                ? { count: { increment: 1 } }
                : { count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) },
          });
        }
        return true;
      }),
    createSession: async (session, audit) => {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${session.userId}, 0))`;
        await tx.authSession.create({ data: session });
        await tx.auditLog.create({ data: audit });
      });
    },
    rotateSession: (old, session, now, audit) =>
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${old.userId}, 0))`;
        const consumed = await tx.authSession.updateMany({
          where: {
            id: old.id,
            tokenHash: old.tokenHash,
            revokedAt: null,
            expiresAt: { gt: now },
            absoluteExpiresAt: { gt: now },
          },
          data: { revokedAt: now },
        });
        if (consumed.count !== 1) return false;
        await tx.authSession.create({ data: session });
        await tx.auditLog.create({ data: audit });
        return true;
      }),
    revokeSession: async (id, now, audit) => {
      await db.$transaction([
        db.authSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } }),
        db.auditLog.create({ data: audit }),
      ]);
    },
    revokeAll: async (userId, now, audit) => {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
        await tx.authSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.auditLog.create({ data: audit });
      });
    },
    listSessions: (userId, now) =>
      db.authSession.findMany({
        where: { userId, revokedAt: null, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
        select: { id: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    audit: async (entry) => {
      await db.auditLog.create({ data: entry });
    },
    listAudit: () =>
      db.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }),
    bootstrapOwner: (email, passwordHash, requestId) =>
      db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('automation.owner.bootstrap.v1', 0))`;
        if (await tx.user.count({ where: { role: 'OWNER' } })) return false;
        const owner = await tx.user.create({ data: { email, passwordHash, role: 'OWNER' } });
        await tx.auditLog.create({
          data: { actorId: owner.id, action: 'owner.bootstrap', targetId: owner.id, requestId },
        });
        return true;
      }),
  };
}
