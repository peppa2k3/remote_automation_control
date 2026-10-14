'use client';
import { useEffect, useState } from 'react';
import { pairingResponseSchema, type DeviceView } from '@automation/contracts';
import { readDeviceFeed } from './feed';
import { DeviceDetails } from './device-details';

export function DevicePanel({ csrf }: { csrf: string }) {
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [connection, setConnection] = useState<'loading' | 'connected' | 'unknown'>('loading');
  const [checkedAt, setCheckedAt] = useState('');
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    function unknown() {
      setDevices([]);
      setConnection('unknown');
      setCode(null);
    }
    async function load() {
      try {
        const rows = await readDeviceFeed(
          AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]),
        );
        if (controller.signal.aborted) return;
        if (!navigator.onLine) {
          unknown();
          return;
        }
        setDevices(rows);
        setConnection('connected');
        setCheckedAt(new Date().toLocaleTimeString('vi-VN'));
      } catch {
        if (!controller.signal.aborted) unknown();
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void load(), 5000);
      }
    }
    window.addEventListener('offline', unknown);
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener('offline', unknown);
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
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('UNAVAILABLE');
      if (path === 'pairing-code') {
        const parsed = pairingResponseSchema.parse(await response.json());
        if (parsed.success) setCode(parsed.data);
      } else {
        const id = path.split('/')[0];
        setDevices((values) =>
          values.map((d) => (d.id === id ? { ...d, onlineState: 'REVOKED' } : d)),
        );
      }
    } catch {
      setError(
        'Không thể thực hiện. Kiểm tra kết nối, quyền và phiên đăng nhập; nếu vượt giới hạn tạo mã hãy thử lại sau.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="system-section" aria-labelledby="devices-heading">
      <div className="section-heading">
        <h1 id="devices-heading">Thiết bị của bạn</h1>
        <button
          className="refresh"
          disabled={busy || connection !== 'connected'}
          onClick={() => void action('pairing-code')}
        >
          Kết nối máy mới
        </button>
      </div>
      <p className="description">
        Tạo mã ghép đôi, chạy lệnh pair tại máy Windows rồi start Agent. Mã chỉ dùng một lần trong 5
        phút. Bạn là chủ của máy được ghép bằng mã mình tạo.
      </p>
      <p role="status">
        {connection === 'connected'
          ? `Đã kết nối server · cập nhật lúc ${checkedAt} · kiểm tra mỗi 5 giây`
          : connection === 'loading'
            ? 'Đang kết nối server…'
            : 'Mất kết nối hoặc phiên đăng nhập hết hạn. Chưa rõ trạng thái thiết bị; không có nghĩa máy đã tắt. Hệ thống đang thử lại.'}
      </p>
      {code && (
        <div className="pairing-code">
          <p>Mã hết hạn lúc {new Date(code.expiresAt).toLocaleTimeString('vi-VN')}</p>
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
      {connection === 'connected' && !devices.length && (
        <div className="next-step">
          <p>
            Chưa có thiết bị. Chọn “Kết nối máy mới” hoặc nhờ chủ máy chia sẻ quyền qua email đăng
            nhập của bạn.
          </p>
        </div>
      )}
      <div className="status-grid">
        {devices.map((device) => (
          <article className="status-card" key={device.id}>
            <div className="card-top">
              <h2>{device.label}</h2>
              <span className={`badge ${device.onlineState === 'ONLINE' ? 'online' : 'offline'}`}>
                {device.onlineState === 'ONLINE'
                  ? 'Agent online'
                  : device.onlineState === 'REVOKED'
                    ? 'Đã thu hồi'
                    : 'Agent offline'}
              </span>
            </div>
            <p>
              {device.role === 'OWNER'
                ? 'Chủ thiết bị'
                : device.role === 'OPERATOR'
                  ? 'Operator'
                  : 'Người xem'}{' '}
              · {device.platform} · {device.arch} · v{device.version}
            </p>
            <p>
              Lần liên lạc cuối:{' '}
              {device.lastSeenAt
                ? new Date(device.lastSeenAt).toLocaleString('vi-VN')
                : 'Chưa có heartbeat'}
            </p>
            {device.runtime && (
              <dl className="device-metrics">
                <dt>Tên máy</dt>
                <dd>{device.runtime.hostname}</dd>
                <dt>Máy đã chạy</dt>
                <dd>{Math.floor(device.runtime.uptimeSeconds / 60)} phút</dd>
                <dt>Agent đã chạy</dt>
                <dd>{Math.floor(device.runtime.agentUptimeSeconds / 60)} phút</dd>
                <dt>RAM còn trống / tổng</dt>
                <dd>
                  {(device.runtime.memoryFreeBytes / 1073741824).toFixed(1)} /{' '}
                  {(device.runtime.memoryTotalBytes / 1073741824).toFixed(1)} GiB
                </dd>
                <dt>CPU logic</dt>
                <dd>{device.runtime.cpuCount}</dd>
              </dl>
            )}
            <p className="card-label">
              Số liệu tại lần heartbeat cuối. Online chỉ xác nhận Agent liên lạc được; desktop và
              MeshCentral chưa tích hợp.
            </p>
            <DeviceDetails device={device} csrf={csrf} />
            {device.role === 'OWNER' && (
              <button
                className="refresh"
                disabled={busy || device.onlineState === 'REVOKED'}
                onClick={() => {
                  if (
                    window.confirm(`Thu hồi kết nối của ${device.label}? Máy sẽ cần ghép đôi lại.`)
                  )
                    void action(`${device.id}/revoke`);
                }}
              >
                Thu hồi thiết bị
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
