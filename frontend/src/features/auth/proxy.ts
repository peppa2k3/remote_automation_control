import { SESSION_COOKIE_NAME, failure } from '@automation/contracts';

const methods: Record<string, string> = {
  login: 'POST',
  me: 'GET',
  refresh: 'POST',
  logout: 'POST',
  sessions: 'GET',
  'revoke-all': 'POST',
};
export async function proxyAuth(
  request: Request,
  action: string,
  baseUrl: string,
  frontendOrigin: string,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  function error(status: number, code: string, message: string) {
    return Response.json(failure(code, message, requestId), {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });
  }
  if (methods[action] !== request.method) return error(404, 'NOT_FOUND', 'Endpoint không tồn tại.');
  return proxySession(request, `auth/${action}`, baseUrl, frontendOrigin);
}

// Called only after each feature's fixed path/method allowlist has validated the route.
export async function proxySession(
  request: Request,
  path: string,
  baseUrl: string,
  frontendOrigin: string,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  function error(status: number, code: string, message: string) {
    return Response.json(failure(code, message, requestId), {
      status,
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });
  }
  const origin = request.headers.get('Origin');
  if ((request.method !== 'GET' || origin) && origin !== frontendOrigin)
    return error(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không được phép.');
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site')
    return error(403, 'ORIGIN_REJECTED', 'Nguồn yêu cầu không được phép.');
  let upstream: URL;
  try {
    upstream = new URL(`${baseUrl.replace(/\/$/, '')}/${path}`);
  } catch {
    return error(503, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.');
  }
  if (
    !['http:', 'https:'].includes(upstream.protocol) ||
    upstream.username ||
    upstream.password ||
    upstream.search ||
    upstream.hash
  )
    return error(503, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.');
  const headers = new Headers();
  const cookieMatches = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (cookieMatches.length === 1 && /^[a-f0-9]{64}$/.test(cookieMatches[0]?.split('=')[1] ?? ''))
    headers.set('Cookie', cookieMatches[0]!);
  if (origin) headers.set('Origin', origin);
  const csrf = request.headers.get('X-CSRF-Token');
  if (csrf && /^[A-Za-z0-9_-]{43}$/.test(csrf)) headers.set('X-CSRF-Token', csrf);
  let body: string | undefined;
  if (request.method === 'POST') {
    if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json')
      return error(415, 'JSON_REQUIRED', 'Yêu cầu phải dùng JSON.');
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      if (reader)
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 32768) {
            await reader.cancel();
            return error(413, 'PAYLOAD_TOO_LARGE', 'Yêu cầu quá lớn.');
          }
          chunks.push(value);
        }
    } catch {
      return error(400, 'INVALID_INPUT', 'Yêu cầu không hợp lệ.');
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    body = new TextDecoder().decode(bytes);
    headers.set('Content-Type', 'application/json');
  }
  try {
    const response = await fetch(upstream, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    const resultHeaders = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    for (const value of response.headers.getSetCookie()) resultHeaders.append('Set-Cookie', value);
    resultHeaders.set('X-Request-Id', response.headers.get('X-Request-Id') ?? requestId);
    return new Response(await response.text(), { status: response.status, headers: resultHeaders });
  } catch {
    return error(503, 'AUTH_UNAVAILABLE', 'Dịch vụ đăng nhập chưa sẵn sàng.');
  }
}
