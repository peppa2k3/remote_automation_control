import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { failure, success } from '@automation/contracts';
import {
  createAuthRouter,
  requireAuth,
  requireOwner,
  assertMutation,
} from './modules/auth/http.js';
import { AuthError } from './modules/auth/types.js';
import type { AuthService } from './modules/auth/service.js';
import type { DeviceService } from './modules/devices/service.js';
import { createAgentRouter, createDeviceRouter } from './modules/devices/http.js';

export interface AppDependencies {
  auth?: AuthService;
  devices?: DeviceService;
  secureCookies?: boolean;
  frontendOrigin: string;
  checkDatabase: () => Promise<void>;
  log?: (record: {
    requestId: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }) => void;
  rateLimitMax?: number;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    const startedAt = Date.now();
    res.on('finish', () =>
      deps.log?.({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
    next();
  });
  app.use(helmet());
  app.use(cors({ origin: deps.frontendOrigin, credentials: true }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: deps.rateLimitMax ?? 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res
          .status(429)
          .json(
            failure('RATE_LIMITED', 'Quá nhiều yêu cầu, hãy thử lại sau.', res.locals.requestId),
          ),
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/v1/health/live', (_req, res) => {
    res.json(
      success(
        { service: 'backend', status: 'ok', timestamp: new Date().toISOString() },
        res.locals.requestId,
      ),
    );
  });
  app.get('/api/v1/health/ready', async (_req, res) => {
    try {
      await deps.checkDatabase();
      res.json(
        success(
          { service: 'backend', status: 'ok', database: 'up', timestamp: new Date().toISOString() },
          res.locals.requestId,
        ),
      );
    } catch {
      res
        .status(503)
        .json(failure('DATABASE_UNAVAILABLE', 'Database chưa sẵn sàng.', res.locals.requestId));
    }
  });
  if (deps.auth)
    app.use(
      '/api/v1/auth',
      createAuthRouter(deps.auth, deps.frontendOrigin, deps.secureCookies ?? false),
    );
  else
    app.use('/api/v1/auth', (_req, res) =>
      res
        .status(503)
        .json(
          failure('AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.', res.locals.requestId),
        ),
    );
  if (deps.devices) app.use('/api/v1/agent', createAgentRouter(deps.devices));
  app.use('/api/v1/agent', (_req, res) =>
    res
      .status(401)
      .json(
        failure('DEVICE_AUTH_REQUIRED', 'Yêu cầu định danh thiết bị riêng.', res.locals.requestId),
      ),
  );
  app.use('/api/v1', async (req, res, next) => {
    if (!deps.auth) throw new AuthError(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập.');
    return requireAuth(deps.auth, deps.frontendOrigin)(req, res, next);
  });
  app.get('/api/v1/admin/audit-logs', requireOwner(), async (_req, res) =>
    res.json(success(await deps.auth!.store.listAudit(), res.locals.requestId)),
  );
  app.use('/api/v1', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      assertMutation(req, res.locals.auth, deps.frontendOrigin);
    }
    next();
  });
  if (deps.devices) app.use('/api/v1/devices', createDeviceRouter(deps.devices));
  app.use('/api/v1', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return requireOwner()(req, res, next);
    next();
  });
  app.use((_req, res) =>
    res.status(404).json(failure('NOT_FOUND', 'Endpoint chưa tồn tại.', res.locals.requestId)),
  );
  const onError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof AuthError) {
      res.status(error.status).json(failure(error.code, error.message, res.locals.requestId));
      return;
    }
    const type =
      typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
    const status = type === 'entity.too.large' ? 413 : type === 'entity.parse.failed' ? 400 : 500;
    const code =
      status === 413 ? 'PAYLOAD_TOO_LARGE' : status === 400 ? 'INVALID_JSON' : 'INTERNAL_ERROR';
    res.status(status).json(failure(code, 'Không thể xử lý yêu cầu.', res.locals.requestId));
  };
  app.use(onError);
  return app;
}
