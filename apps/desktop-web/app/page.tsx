'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session?.token) {
      router.replace('/login');
    } else if (!session.orgId) {
      router.replace('/org');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <main className="auth-bg flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground dark:text-slate-400">Loading LocalSync…</p>
    </main>
  );
}
