import { cookies } from 'next/headers';
import { authResponseSchema, SESSION_COOKIE_NAME } from '@automation/contracts';

export function backendBaseUrl() {
  return (
    process.env.API_INTERNAL_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:4000/api/v1'
  );
}
export async function getServerSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const response = await fetch(`${backendBaseUrl()}/auth/me`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
    });
    const parsed = authResponseSchema.safeParse(await response.json());
    return response.ok && parsed.success && parsed.data.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}
