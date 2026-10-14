import { failure } from '@automation/contracts';
import { proxySession } from '../auth/proxy';
export function proxyDevices(request: Request, path: string[], baseUrl: string, origin: string) {
  const endpoint = path.join('/');
  const id = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
  const allowed =
    (request.method === 'GET' &&
      (endpoint === '' || new RegExp(`^${id}/(activity|members)$`).test(endpoint))) ||
    (request.method === 'POST' &&
      (endpoint === 'pairing-code' ||
        new RegExp(`^${id}/(revoke|members|members/remove)$`).test(endpoint)));
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
