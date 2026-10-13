import { failure } from '@automation/contracts';
import { proxySession } from '../auth/proxy';
export function proxyDevices(request: Request, path: string[], baseUrl: string, origin: string) {
  const endpoint = path.join('/');
  const allowed =
    (request.method === 'GET' && endpoint === '') ||
    (request.method === 'POST' &&
      (endpoint === 'pairing-code' ||
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/revoke$/.test(endpoint)));
  if (!allowed) {
    const id = crypto.randomUUID();
    return Promise.resolve(
      Response.json(failure('NOT_FOUND', 'Endpoint không tồn tại.', id), {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'X-Request-Id': id },
      }),
    );
  }
  return proxySession(request, `devices${endpoint ? `/${endpoint}` : ''}`, baseUrl, origin);
}
