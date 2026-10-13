import {
  Router,
  type CookieOptions,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { SESSION_COOKIE_NAME, success } from '@automation/contracts';
import { csrfToken, equalCsrf } from './crypto.js';
import { AuthError } from './types.js';
import { AuthService, type AuthContext } from './service.js';

export function readSessionCookie(header: string | undefined): string | null {
  const matches = (header ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (matches.length !== 1) return null;
  const token = matches[0]?.slice(SESSION_COOKIE_NAME.length + 1) ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function assertOrigin(req: Request, origin: string, required = true) {
  const actual = req.get('Origin');
  if ((required || actual) && actual !== origin)
    throw new AuthError(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không được phép.');
  if (req.get('Sec-Fetch-Site') === 'cross-site')
    throw new AuthError(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không được phép.');
}
export function assertMutation(req: Request, context: AuthContext, origin: string) {
  assertOrigin(req, origin);
  if (!req.is('application/json'))
    throw new AuthError(415, 'JSON_REQUIRED', 'Yêu cầu phải dùng JSON.');
  if (!equalCsrf(req.get('X-CSRF-Token'), csrfToken(context.token)))
    throw new AuthError(403, 'CSRF_REJECTED', 'CSRF token không hợp lệ.');
}
export function requireAuth(service: AuthService, origin: string): RequestHandler {
  return async (req, res, next) => {
    assertOrigin(req, origin, false);
    res.locals.auth = await service.authenticate(readSessionCookie(req.get('Cookie')));
    next();
  };
}
export function requireOwner(): RequestHandler {
  return (_req, res, next) => {
    if ((res.locals.auth as AuthContext).user.role !== 'OWNER')
      throw new AuthError(403, 'FORBIDDEN', 'Chỉ owner được thực hiện thao tác này.');
    next();
  };
}
export function createAuthRouter(service: AuthService, origin: string, secure: boolean): Router {
  const router = Router();
  const options: CookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/' };
  function cookie(res: Response, context: AuthContext) {
    res.cookie(SESSION_COOKIE_NAME, context.token, {
      ...options,
      expires: context.session.expiresAt,
    });
  }
  router.post('/login', async (req, res) => {
    assertOrigin(req, origin);
    if (!req.is('application/json'))
      throw new AuthError(415, 'JSON_REQUIRED', 'Yêu cầu phải dùng JSON.');
    const context = await service.login(req.body, req.ip ?? 'unknown', res.locals.requestId);
    cookie(res, context);
    res.json(success(service.data(context), res.locals.requestId));
  });
  router.use(requireAuth(service, origin));
  router.get('/me', (_req, res) =>
    res.json(success(service.data(res.locals.auth), res.locals.requestId)),
  );
  router.get('/sessions', async (_req, res) =>
    res.json(success(await service.listSessions(res.locals.auth), res.locals.requestId)),
  );
  router.post('/refresh', async (req, res) => {
    assertMutation(req, res.locals.auth, origin);
    const context = await service.refresh(res.locals.auth, res.locals.requestId);
    cookie(res, context);
    res.json(success(service.data(context), res.locals.requestId));
  });
  router.post('/logout', async (req, res) => {
    assertMutation(req, res.locals.auth, origin);
    await service.logout(res.locals.auth, res.locals.requestId);
    res.clearCookie(SESSION_COOKIE_NAME, options);
    res.json(success({ loggedOut: true }, res.locals.requestId));
  });
  router.post('/revoke-all', async (req, res) => {
    assertMutation(req, res.locals.auth, origin);
    await service.revokeAll(res.locals.auth, res.locals.requestId);
    res.clearCookie(SESSION_COOKIE_NAME, options);
    res.json(success({ revoked: true }, res.locals.requestId));
  });
  return router;
}
