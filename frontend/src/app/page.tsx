import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../features/auth/server-session';
import { SessionControls } from '../features/auth/session-controls';
import { RefreshButton } from '../components/refresh-button';
import { getPlatformStatus } from '../lib/platform-status';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession();
  if (!session) redirect('/login');
  const status = await getPlatformStatus(
    process.env.API_INTERNAL_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:4000/api/v1',
  );
  const checks = [
    {
      title: 'Kết nối API',
      subtitle: 'Trung tâm điều phối',
      ready: status.api,
      detail: status.api ? 'API đang hoạt động' : 'Chưa kết nối được API',
    },
    {
      title: 'PostgreSQL',
      subtitle: 'Lưu trữ bền vững',
      ready: status.database,
      detail: status.database ? 'Database sẵn sàng' : 'Database chưa sẵn sàng',
    },
  ];

  return (
    <main>
      <header>
        <Link href="/" className="brand">
          <span className="brand-icon" aria-hidden="true">
            ⌂
          </span>
          <span>
            Automation<span className="brand-light"> Control</span>
          </span>
        </Link>
        <span className="environment">LOCAL / BOOTSTRAP</span>
      </header>
      <SessionControls initial={session} />
      <section className="intro">
        <p className="eyebrow">HOME AUTOMATION PLATFORM</p>
        <h1>
          Trung tâm điều phối
          <br />
          <span>cho ngôi nhà của bạn.</span>
        </h1>
        <p className="description">
          Theo dõi nền tảng trước khi kết nối Windows Agent và thiết lập workflow đầu tiên.
        </p>
      </section>
      <section className="system-section" aria-labelledby="system-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRẠNG THÁI HỆ THỐNG</p>
            <h2 id="system-heading">Kiểm tra kết nối</h2>
          </div>
          <RefreshButton />
        </div>
        <div className="status-grid">
          {checks.map((check) => (
            <article className="status-card" key={check.title}>
              <div className="card-top">
                <span className="service-icon" aria-hidden="true">
                  {check.title === 'PostgreSQL' ? '▤' : '⌁'}
                </span>
                <span className={`badge ${check.ready ? 'online' : 'offline'}`}>
                  <span className="dot" />
                  {check.ready ? 'Sẵn sàng' : 'Cần kết nối'}
                </span>
              </div>
              <p className="card-label">{check.subtitle}</p>
              <h3>{check.title}</h3>
              <p className="card-detail">{check.detail}</p>
            </article>
          ))}
        </div>
        <p className="checked-at">
          Kiểm tra lúc{' '}
          {new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            dateStyle: 'short',
            timeStyle: 'medium',
          }).format(new Date(status.checkedAt))}{' '}
          · GMT+7
        </p>
      </section>
      <section className="next-step">
        <span className="step-number">01</span>
        <div>
          <p className="eyebrow">BƯỚC TIẾP THEO</p>
          <h2>Kết nối Windows Agent</h2>
          <p>
            Đăng nhập quản trị đã sẵn sàng; ghép đôi thiết bị sẽ được triển khai ở prompt 005. Hiện
            CLI Agent hỗ trợ kiểm tra kết nối với API.
          </p>
        </div>
        <span className="planned">Đã lên kế hoạch</span>
      </section>
      <footer>
        <span>VPS điều phối. Windows thực thi.</span>
        <span>Khởi tạo nền tảng · v0.1.0</span>
      </footer>
    </main>
  );
}
