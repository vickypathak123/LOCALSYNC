'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAgentSession, clearAgentSession, type AgentSession } from '@/lib/auth';

export default function AgentOnboardedPage() {
  const router = useRouter();
  const [session, setLocalSession] = useState<AgentSession | null>(null);

  useEffect(() => {
    const s = getAgentSession();
    if (!s?.token) {
      router.replace('/agent/login');
      return;
    }
    setLocalSession(s);
  }, [router]);

  function handleLogout() {
    clearAgentSession();
    router.replace('/agent/login');
  }

  if (!session) return null;

  return (
    <main className="auth-bg flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-verified/10 shadow-elevation-2">
        <svg viewBox="0 0 24 24" className="h-7 w-7 text-status-verified" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold text-foreground dark:text-slate-100">You're all set</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground dark:text-slate-400">
          Your account is active and assigned to your organization. Open the LocalSync mobile app and sign in
          with your email and new password to go online and start receiving tasks.
        </p>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 hover:underline dark:text-slate-400"
      >
        Log out
      </button>
    </main>
  );
}
