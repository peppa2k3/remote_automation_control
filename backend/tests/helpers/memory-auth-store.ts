import { randomUUID } from 'node:crypto';
import type {
  AuthStore,
  AuthUser,
  StoredSession,
  AuditEntry,
} from '../../src/modules/auth/types.js';

// Test double only. Runtime always uses PostgreSQL.
export class MemoryAuthStore implements AuthStore {
  users = new Map<string, AuthUser>();
  sessions = new Map<string, StoredSession>();
  attempts = new Map<string, { count: number; resetAt: Date }>();
  events: (AuditEntry & { id: string; createdAt: Date })[] = [];
  async findUser(email: string) {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }
  async findSession(hash: string) {
    const session = [...this.sessions.values()].find((item) => item.tokenHash === hash);
    const user = session && this.users.get(session.userId);
    return session && user ? { ...session, user } : null;
  }
  async consumeAttempts(keys: { key: string; limit: number }[], now: Date, seconds: number) {
    if (
      keys.some((item) => {
        const current = this.attempts.get(item.key);
        return current && current.resetAt > now && current.count >= item.limit;
      })
    )
      return false;
    for (const { key } of keys) {
      const current = this.attempts.get(key);
      this.attempts.set(key, {
        count: current && current.resetAt > now ? current.count + 1 : 1,
        resetAt:
          current && current.resetAt > now
            ? current.resetAt
            : new Date(now.getTime() + seconds * 1000),
      });
    }
    return true;
  }
  async createSession(session: StoredSession, audit: AuditEntry) {
    this.sessions.set(session.id, session);
    await this.audit(audit);
  }
  async rotateSession(old: StoredSession, session: StoredSession, now: Date, audit: AuditEntry) {
    const current = this.sessions.get(old.id);
    if (
      !current ||
      current.revokedAt ||
      current.expiresAt <= now ||
      current.absoluteExpiresAt <= now
    )
      return false;
    current.revokedAt = now;
    await this.createSession(session, audit);
    return true;
  }
  async revokeSession(id: string, now: Date, audit: AuditEntry) {
    const item = this.sessions.get(id);
    if (item) item.revokedAt = now;
    await this.audit(audit);
  }
  async revokeAll(userId: string, now: Date, audit: AuditEntry) {
    for (const session of this.sessions.values())
      if (session.userId === userId) session.revokedAt = now;
    await this.audit(audit);
  }
  async listSessions(userId: string, now: Date) {
    return [...this.sessions.values()]
      .filter((item) => item.userId === userId && !item.revokedAt && item.expiresAt > now)
      .map(({ id, expiresAt, createdAt }) => ({ id, expiresAt, createdAt }));
  }
  async audit(entry: AuditEntry) {
    this.events.push({ ...entry, id: randomUUID(), createdAt: new Date() });
  }
  async listAudit() {
    return this.events;
  }
  async bootstrapOwner(email: string, passwordHash: string, requestId: string) {
    if ([...this.users.values()].some((item) => item.role === 'OWNER')) return false;
    const id = randomUUID();
    this.users.set(id, {
      id,
      email,
      passwordHash,
      role: 'OWNER',
      status: 'ACTIVE',
      mfaEnabled: false,
    });
    await this.audit({ actorId: id, targetId: id, action: 'owner.bootstrap', requestId });
    return true;
  }
}
