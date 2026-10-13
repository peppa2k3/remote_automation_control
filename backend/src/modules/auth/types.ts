import type { UserRole } from '@automation/contracts';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  mfaEnabled: boolean;
}
export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetId: string | null;
  requestId: string;
}
export interface AuthStore {
  findUser(email: string): Promise<AuthUser | null>;
  findSession(hash: string): Promise<(StoredSession & { user: AuthUser }) | null>;
  consumeAttempts(
    keys: { key: string; limit: number }[],
    now: Date,
    windowSeconds: number,
  ): Promise<boolean>;
  createSession(session: StoredSession, audit: AuditEntry): Promise<void>;
  rotateSession(
    old: StoredSession,
    session: StoredSession,
    now: Date,
    audit: AuditEntry,
  ): Promise<boolean>;
  revokeSession(id: string, now: Date, audit: AuditEntry): Promise<void>;
  revokeAll(userId: string, now: Date, audit: AuditEntry): Promise<void>;
  listSessions(
    userId: string,
    now: Date,
  ): Promise<Pick<StoredSession, 'id' | 'createdAt' | 'expiresAt'>[]>;
  audit(entry: AuditEntry): Promise<void>;
  listAudit(): Promise<(AuditEntry & { id: string; createdAt: Date })[]>;
  bootstrapOwner(email: string, passwordHash: string, requestId: string): Promise<boolean>;
}
export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
