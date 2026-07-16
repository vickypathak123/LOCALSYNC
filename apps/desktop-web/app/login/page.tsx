'use client';

import { useRouter } from 'next/navigation';
import AuthForms from '@/components/AuthForms';
import { setSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  function handleSuccess(session: { token: string; ownerId: string; orgId: string; ownerName: string }) {
    setSession(session);
    router.replace(session.orgId ? '/dashboard' : '/org');
  }

  return (
    <main className="auth-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-elevation-2">
          <span className="font-display text-lg font-bold">L</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground dark:text-slate-100">LocalSync</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">
          Real-time field-ops coordination for your team
        </p>
      </div>
      <AuthForms onSuccess={handleSuccess} />
    </main>
  );
}
