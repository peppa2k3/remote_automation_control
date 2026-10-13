import { redirect } from 'next/navigation';
import { getServerSession } from '../../features/auth/server-session';
import { LoginForm } from '../../features/auth/login-form';
export const dynamic = 'force-dynamic';
export default async function Login() {
  if (await getServerSession()) redirect('/');
  return (
    <main className="login-main">
      <section className="login-card">
        <p className="eyebrow">AUTOMATION CONTROL</p>
        <h1>Đăng nhập quản trị</h1>
        <p className="description">Đăng nhập để truy cập trung tâm điều phối của bạn.</p>
        <LoginForm />
        <p className="login-note">
          Tài khoản được chủ hệ thống cấp. Liên hệ quản trị viên nếu bạn chưa có tài khoản.
        </p>
      </section>
    </main>
  );
}
