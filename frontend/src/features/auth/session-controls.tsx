'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authResponseSchema, type AuthData } from '@automation/contracts';

export function SessionControls({ initial }: { initial: AuthData }) {
  const [session, setSession] = useState(initial),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState('');
  const router = useRouter();
  async function action(name: 'refresh' | 'logout' | 'revoke-all') {
    if (pending) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/v1/auth/${name}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
        body: '{}',
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/login');
          router.refresh();
        } else setMessage('Không thể thực hiện thao tác. Vui lòng thử lại.');
        return;
      }
      if (name === 'refresh') {
        const parsed = authResponseSchema.safeParse(body);
        if (!parsed.success || !parsed.data.success) throw new Error('INVALID_RESPONSE');
        setSession(parsed.data.data);
        setMessage('Đã gia hạn session.');
        // Refresh server-rendered consumers of the rotated CSRF token (e.g. DevicePanel).
        router.refresh();
      } else {
        router.replace('/login');
        router.refresh();
      }
    } catch {
      setMessage('Không kết nối được dịch vụ đăng nhập.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="account-panel" aria-label="Tài khoản và session">
      <div>
        <strong>{session.user.email}</strong>
        <p className="card-label">Vai trò: {session.user.role} · MFA chưa thiết lập</p>
      </div>
      <div className="account-actions">
        <button className="refresh" disabled={pending} onClick={() => void action('refresh')}>
          Gia hạn
        </button>
        <button className="refresh" disabled={pending} onClick={() => void action('logout')}>
          Đăng xuất
        </button>
        <button className="refresh" disabled={pending} onClick={() => void action('revoke-all')}>
          Đăng xuất mọi thiết bị
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
