'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="refresh"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-live="polite"
    >
      {pending ? 'Đang kiểm tra…' : '↻ Kiểm tra lại'}
    </button>
  );
}
