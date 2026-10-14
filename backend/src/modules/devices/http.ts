import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  heartbeatInputSchema,
  memberInputSchema,
  removeMemberInputSchema,
  deviceTokenSchema,
  emptyInputSchema,
  pairInputSchema,
  rotateInputSchema,
  success,
} from '@automation/contracts';
import { AuthError } from '../auth/types.js';
import type { DeviceService } from './service.js';

function json(req: Request) {
  if (!req.is('application/json'))
    throw new AuthError(415, 'JSON_REQUIRED', 'Yêu cầu phải dùng JSON.');
}
function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AuthError(400, 'INVALID_INPUT', 'Yêu cầu thiết bị không hợp lệ.');
  return result.data;
}
function token(req: Request) {
  const bearer = /^Bearer (agt_[a-f0-9]{64})$/.exec(req.get('Authorization') ?? '');
  if (!bearer?.[1])
    throw new AuthError(401, 'DEVICE_AUTH_REQUIRED', 'Yêu cầu credential thiết bị riêng.');
  return bearer[1];
}
export function createAgentRouter(service: DeviceService): Router {
  const router = Router();
  router.use((req, _res, next) => {
    if (req.get('Origin'))
      throw new AuthError(403, 'AGENT_ORIGIN_REJECTED', 'API này chỉ dành cho Agent native.');
    next();
  });
  router.post('/pair', async (req, res) => {
    json(req);
    res.json(
      success(
        await service.pair(
          parse(pairInputSchema, req.body),
          req.ip ?? 'unknown',
          res.locals.requestId,
        ),
        res.locals.requestId,
      ),
    );
  });
  router.post('/heartbeat', async (req, res) => {
    const raw = token(req);
    json(req);
    res.json(
      success(
        await service.heartbeat(raw, parse(heartbeatInputSchema, req.body)),
        res.locals.requestId,
      ),
    );
  });
  router.post('/credentials/rotate', async (req, res) => {
    const raw = token(req);
    json(req);
    res.json(
      success(
        await service.stageRotation(
          raw,
          parse(rotateInputSchema, req.body).token,
          res.locals.requestId,
        ),
        res.locals.requestId,
      ),
    );
  });
  router.post('/credentials/commit', async (req, res) => {
    const raw = token(req);
    json(req);
    parse(emptyInputSchema, req.body);
    res.json(
      success(await service.commitRotation(raw, res.locals.requestId), res.locals.requestId),
    );
  });
  router.use(async (req, res) => {
    parse(deviceTokenSchema, token(req));
    await service.authenticate(token(req), 'agent:heartbeat');
    res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Endpoint chưa triển khai.' },
      requestId: res.locals.requestId,
    });
  });
  return router;
}
export function createDeviceRouter(service: DeviceService): Router {
  const router = Router();
  router.get('/', async (_req, res) =>
    res.json(success(await service.list(res.locals.auth.user.id), res.locals.requestId)),
  );
  router.post('/pairing-code', async (req, res) => {
    parse(emptyInputSchema, req.body);
    res.json(
      success(
        await service.createCode(res.locals.auth.user.id, res.locals.requestId),
        res.locals.requestId,
      ),
    );
  });
  router.post('/:deviceId/revoke', async (req, res) => {
    parse(emptyInputSchema, req.body);
    const id = parse(z.uuid(), req.params.deviceId);
    await service.revoke(id, res.locals.auth.user.id, res.locals.requestId);
    res.json(success({ revoked: true }, res.locals.requestId));
  });
  router.get('/:deviceId/activity', async (req, res) => {
    res.json(
      success(
        await service.activity(parse(z.uuid(), req.params.deviceId), res.locals.auth.user.id),
        res.locals.requestId,
      ),
    );
  });
  router.get('/:deviceId/members', async (req, res) => {
    res.json(
      success(
        await service.members(parse(z.uuid(), req.params.deviceId), res.locals.auth.user.id),
        res.locals.requestId,
      ),
    );
  });
  router.post('/:deviceId/members', async (req, res) => {
    await service.setMember(
      parse(z.uuid(), req.params.deviceId),
      res.locals.auth.user.id,
      parse(memberInputSchema, req.body),
      res.locals.requestId,
    );
    res.json(success({ updated: true }, res.locals.requestId));
  });
  router.post('/:deviceId/members/remove', async (req, res) => {
    await service.removeMember(
      parse(z.uuid(), req.params.deviceId),
      res.locals.auth.user.id,
      parse(removeMemberInputSchema, req.body).userId,
      res.locals.requestId,
    );
    res.json(success({ removed: true }, res.locals.requestId));
  });
  return router;
}
