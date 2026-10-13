import { randomUUID } from 'node:crypto';
import { loginInputSchema, type AuthData } from '@automation/contracts';
import { csrfToken, digest, hashPassword, newToken, tokenHash, verifyPassword } from './crypto.js';
import { AuthError, type AuthStore, type AuthUser, type StoredSession } from './types.js';

export interface AuthSettings {
  sessionSeconds: number;
  absoluteSeconds: number;
  loginWindowSeconds: number;
  accountLimit: number;
  ipLimit: number;
}
export const defaultAuthSettings: AuthSettings = {
  sessionSeconds: 1800,
  absoluteSeconds: 28800,
  loginWindowSeconds: 900,
  accountLimit: 5,
  ipLimit: 30,
};
export interface AuthContext {
  token: string;
  session: StoredSession;
  user: AuthUser;
}

export class AuthService {
  private readonly dummyHash = `scrypt$32768$8$3$${'0'.repeat(32)}$${'0'.repeat(128)}`;
  constructor(
    readonly store: AuthStore,
    readonly settings: AuthSettings = defaultAuthSettings,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  private issue(userId: string, absoluteExpiresAt: Date) {
    const now = this.clock(),
      token = newToken();
    const session: StoredSession = {
      id: randomUUID(),
      userId,
      tokenHash: tokenHash(token),
      expiresAt: new Date(
        Math.min(now.getTime() + this.settings.sessionSeconds * 1000, absoluteExpiresAt.getTime()),
      ),
      absoluteExpiresAt,
      revokedAt: null,
      createdAt: now,
    };
    return { token, session };
  }
  data(context: AuthContext): AuthData {
    const { id, email, role, mfaEnabled } = context.user;
    return {
      user: { id, email, role, mfaEnabled },
      csrfToken: csrfToken(context.token),
      sessionExpiresAt: context.session.expiresAt.toISOString(),
    };
  }
  async login(input: unknown, ip: string, requestId: string): Promise<AuthContext> {
    const parsed = loginInputSchema.safeParse(input);
    if (!parsed.success)
      throw new AuthError(400, 'INVALID_INPUT', 'Email hoặc mật khẩu không hợp lệ.');
    const { email, password } = parsed.data;
    const allowed = await this.store.consumeAttempts(
      [
        { key: digest(`login.account:${email}`), limit: this.settings.accountLimit },
        { key: digest(`login.ip:${ip}`), limit: this.settings.ipLimit },
      ],
      this.clock(),
      this.settings.loginWindowSeconds,
    );
    if (!allowed)
      throw new AuthError(
        429,
        'LOGIN_RATE_LIMITED',
        'Đã vượt giới hạn đăng nhập. Hãy thử lại sau.',
      );
    const user = await this.store.findUser(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid || user.status !== 'ACTIVE') {
      await this.store.audit({
        actorId: null,
        action: 'auth.login.failed',
        targetId: null,
        requestId,
      });
      throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng.');
    }
    if (user.mfaEnabled)
      throw new AuthError(
        401,
        'MFA_REQUIRED',
        'Tài khoản yêu cầu MFA; cần triển khai bước xác thực MFA trước khi đăng nhập.',
      );
    const issued = this.issue(
      user.id,
      new Date(this.clock().getTime() + this.settings.absoluteSeconds * 1000),
    );
    await this.store.createSession(issued.session, {
      actorId: user.id,
      action: 'auth.login',
      targetId: issued.session.id,
      requestId,
    });
    return { ...issued, user };
  }
  async authenticate(token: string | null): Promise<AuthContext> {
    const stored =
      token && /^[a-f0-9]{64}$/.test(token) ? await this.store.findSession(tokenHash(token)) : null;
    const now = this.clock();
    if (
      !token ||
      !stored ||
      stored.revokedAt ||
      stored.expiresAt <= now ||
      stored.absoluteExpiresAt <= now ||
      stored.user.status !== 'ACTIVE' ||
      stored.user.mfaEnabled
    )
      throw new AuthError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập.');
    return { token, session: stored, user: stored.user };
  }
  async refresh(context: AuthContext, requestId: string) {
    const issued = this.issue(context.user.id, context.session.absoluteExpiresAt);
    if (
      !(await this.store.rotateSession(context.session, issued.session, this.clock(), {
        actorId: context.user.id,
        action: 'auth.refresh',
        targetId: context.session.id,
        requestId,
      }))
    )
      throw new AuthError(401, 'AUTH_REQUIRED', 'Session đã hết hạn hoặc bị thu hồi.');
    return { ...issued, user: context.user };
  }
  async logout(context: AuthContext, requestId: string) {
    await this.store.revokeSession(context.session.id, this.clock(), {
      actorId: context.user.id,
      action: 'auth.logout',
      targetId: context.session.id,
      requestId,
    });
  }
  async revokeAll(context: AuthContext, requestId: string) {
    await this.store.revokeAll(context.user.id, this.clock(), {
      actorId: context.user.id,
      action: 'auth.revoke_all',
      targetId: context.user.id,
      requestId,
    });
  }
  listSessions(context: AuthContext) {
    return this.store.listSessions(context.user.id, this.clock());
  }
}

export async function bootstrapOwner(store: AuthStore, email: string, password: string) {
  const parsed = loginInputSchema.safeParse({ email, password });
  if (!parsed.success || password.length < 12)
    throw new AuthError(
      400,
      'INVALID_INPUT',
      'Email hợp lệ và mật khẩu 12–128 ký tự (tối đa 128 byte UTF-8) là bắt buộc.',
    );
  if (!(await store.bootstrapOwner(parsed.data.email, await hashPassword(password), randomUUID())))
    throw new AuthError(409, 'OWNER_EXISTS', 'Owner đã tồn tại; bootstrap không ghi đè tài khoản.');
}
