import { proxyAuth } from '../../../../../features/auth/proxy';
import { backendBaseUrl } from '../../../../../features/auth/server-session';
export const dynamic = 'force-dynamic';
async function handler(request: Request, context: { params: Promise<{ action: string }> }) {
  return proxyAuth(
    request,
    (await context.params).action,
    backendBaseUrl(),
    process.env.AUTH_FRONTEND_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  );
}
export { handler as GET, handler as POST };
