import { proxyDevices } from '../../../../../features/devices/proxy';
import { backendBaseUrl } from '../../../../../features/auth/server-session';
export const dynamic = 'force-dynamic';
async function handler(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  return proxyDevices(
    request,
    (await context.params).path ?? [],
    backendBaseUrl(),
    process.env.AUTH_FRONTEND_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  );
}
export { handler as GET, handler as POST };
