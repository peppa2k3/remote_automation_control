import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../features/auth/server-session';
import { DevicePanel } from '../../features/devices/device-panel';
export const dynamic = 'force-dynamic';
export default async function Devices() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return (
    <main>
      <header>
        <Link className="brand" href="/">
          Automation Control
        </Link>
        <Link href="/">Dashboard</Link>
      </header>
      {session.user.role === 'OWNER' ? (
        <DevicePanel csrf={session.csrfToken} />
      ) : (
        <p role="alert">Chỉ owner được quản lý thiết bị.</p>
      )}
    </main>
  );
}
