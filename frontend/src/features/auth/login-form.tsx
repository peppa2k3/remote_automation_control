'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authResponseSchema } from '@automation/contracts';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        signal: AbortSignal.timeout(10_000),
      });
      const parsed = authResponseSchema.safeParse(await response.json());
      if (!response.ok || !parsed.success || !parsed.data.success) {
        setError(
          parsed.success && !parsed.data.success
            ? parsed.data.error.message
            : 'Không thể đăng nhập. Hãy thử lại.',
        );
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Không kết nối được dịch vụ đăng nhập.');
    } finally {
      setPassword('');
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="auth-form">
      <label htmlFor="email">Email quản trị</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        required
        maxLength={254}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
      />
      <label htmlFor="password">Mật khẩu</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        required
        maxLength={128}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={pending}
      />
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="refresh auth-submit" type="submit" disabled={pending}>
        {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  );
}
