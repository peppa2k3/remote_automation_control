'use client';
import { useState } from 'react';
import {
  activityResponseSchema,
  membersResponseSchema,
  type DeviceView,
} from '@automation/contracts';

const labels: Record<string, string> = {
  'device.pair': 'Ghép đôi thiết bị',
  'device.online': 'Agent kết nối lại',
  'device.revoke': 'Thu hồi thiết bị',
  'device.rotate.stage': 'Chuẩn bị đổi credential',
  'device.rotate.commit': 'Đã đổi credential',
  'device.member.updated': 'Cập nhật quyền thành viên',
  'device.member.removed': 'Gỡ thành viên',
};
export function DeviceDetails({ device, csrf }: { device: DeviceView; csrf: string }) {
  const [activity, setActivity] = useState<{ id: string; action: string; createdAt: string }[]>([]);
  const [members, setMembers] = useState<{ userId: string; email: string; role: string }[]>([]);
  const [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [email, setEmail] = useState(''),
    [role, setRole] = useState('VIEWER');
  async function read() {
    const response = await fetch(`/api/v1/devices/${device.id}/activity`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    const parsed = activityResponseSchema.parse(await response.json());
    if (!response.ok || !parsed.success) throw new Error('UNAVAILABLE');
    setActivity(parsed.data);
    if (device.role === 'OWNER') {
      const response = await fetch(`/api/v1/devices/${device.id}/members`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(6000),
      });
      const parsed = membersResponseSchema.parse(await response.json());
      if (!response.ok || !parsed.success) throw new Error('UNAVAILABLE');
      setMembers(parsed.data);
    }
    setOpened(true);
  }
  async function run(path?: string, body?: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (path) {
        const response = await fetch(`/api/v1/devices/${device.id}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000),
        });
        if (!response.ok) throw new Error('UNAVAILABLE');
      }
      await read();
    } catch {
      setActivity([]);
      setMembers([]);
      setError(
        'Không thể tải hoặc thay đổi. Kiểm tra quyền, kết nối và email tài khoản đã được tạo.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="device-details">
      <button className="refresh" disabled={busy} onClick={() => void run()}>
        {opened ? 'Làm mới chi tiết' : 'Hoạt động và thành viên'}
      </button>
      {error && <p role="alert">{error}</p>}
      {opened && (
        <>
          <h3>Hoạt động gần đây</h3>
          <ul>
            {activity.map((item) => (
              <li key={item.id}>
                {new Date(item.createdAt).toLocaleString('vi-VN')} —{' '}
                {labels[item.action] ?? item.action}
              </li>
            ))}
          </ul>
          {!activity.length && <p>Chưa có sự kiện.</p>}
          {device.role === 'OWNER' && (
            <>
              <h3>Chia sẻ quyền xem</h3>
              <p>Viewer và operator đều chỉ xem ở bước core; điều khiển sẽ được bổ sung sau.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('members', { email, role });
                }}
              >
                <label>
                  Email thành viên
                  <input
                    type="email"
                    required
                    value={email}
                    maxLength={254}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  Vai trò
                  <select value={role} onChange={(event) => setRole(event.target.value)}>
                    <option value="VIEWER">Viewer — xem</option>
                    <option value="OPERATOR">Operator — xem, dành cho điều khiển sau</option>
                  </select>
                </label>
                <button className="refresh" disabled={busy || device.onlineState === 'REVOKED'}>
                  Lưu quyền
                </button>
              </form>
              <ul>
                {members.map((member) => (
                  <li key={member.userId}>
                    {member.email} · {member.role}{' '}
                    <button
                      className="refresh"
                      disabled={busy}
                      onClick={() => void run('members/remove', { userId: member.userId })}
                    >
                      Gỡ quyền
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
