'use client';
import { useEffect, useState } from 'react';
import {
  devicesResponseSchema,
  pairingResponseSchema,
  type DeviceView,
} from '@automation/contracts';

export function DevicePanel({ csrf }: { csrf: string }) {
  const [devices, setDevices] = useState<DeviceView[]>([]),
    [loaded, setLoaded] = useState(false);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/v1/devices', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = devicesResponseSchema.safeParse(await response.json());
        if (!response.ok || !body.success || !body.data.success) throw new Error('UNAVAILABLE');
        setDevices(body.data.data);
        setLoaded(true);
        setError('');
      } catch {
        if (!controller.signal.aborted)
          setError('Không tải được trạng thái thiết bị. Hãy kiểm tra đăng nhập và kết nối.');
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(
      () => setCode(null),
      Math.max(0, Date.parse(code.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [code]);
  async function action(path: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/devices/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: '{}',
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Đã vượt giới hạn. Vui lòng thử lại sau.'
            : 'Không thể thực hiện. Làm mới trang để kiểm tra session.',
        );
        return;
      }
      if (path === 'pairing-code') {
        const parsed = pairingResponseSchema.safeParse(await response.json());
        if (!parsed.success || !parsed.data.success) throw new Error('INVALID_RESPONSE');
        setCode(parsed.data.data);
      } else {
        const id = path.split('/')[0];
        setDevices((values) =>
          values.map((device) =>
            device.id === id ? { ...device, onlineState: 'REVOKED' } : device,
          ),
        );
      }
    } catch {
      setError('Không kết nối được dịch vụ thiết bị.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="system-section" aria-labelledby="devices-heading">
      <div className="section-heading">
        <h2 id="devices-heading">Windows Agent</h2>
        <button className="refresh" disabled={busy} onClick={() => void action('pairing-code')}>
          Tạo mã ghép đôi
        </button>
      </div>
      <p className="description">
        Mã dùng một lần trong 5 phút. Nhập mã vào Agent trên máy Windows của bạn.
      </p>
      {code && (
        <div className="pairing-code">
          <p>Mã ghép đôi · hết hạn lúc {new Date(code.expiresAt).toLocaleTimeString('vi-VN')}</p>
          <code>{code.code}</code>
          <button className="refresh" onClick={() => setCode(null)}>
            Ẩn mã
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="auth-error">
          {error}
        </p>
      )}
      {loaded && devices.length === 0 && <p>Chưa có thiết bị được ghép đôi.</p>}
      <div className="status-grid">
        {devices.map((device) => (
          <article className="status-card" key={device.id}>
            <div className="card-top">
              <h3>{device.label}</h3>
              <span className={`badge ${device.onlineState === 'ONLINE' ? 'online' : 'offline'}`}>
                {device.onlineState === 'ONLINE'
                  ? 'Online'
                  : device.onlineState === 'REVOKED'
                    ? 'Đã thu hồi'
                    : 'Offline'}
              </span>
            </div>
            <p>
              {device.platform} · {device.arch} · v{device.version}
            </p>
            <p className="card-label">
              Lần kết nối cuối:{' '}
              {device.lastSeenAt
                ? new Date(device.lastSeenAt).toLocaleString('vi-VN')
                : 'Chưa có heartbeat'}
            </p>
            <button
              className="refresh"
              disabled={busy || device.onlineState === 'REVOKED'}
              onClick={() => void action(`${device.id}/revoke`)}
            >
              Thu hồi thiết bị
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
