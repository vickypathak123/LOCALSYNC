'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAgentPassword } from '@/lib/api';
import { getAgentSession, setAgentSession, type AgentSession } from '@/lib/auth';

export default function AgentSetPasswordPage() {
  const router = useRouter();
  const [session, setLocalSession] = useState<AgentSession | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = getAgentSession();
    if (!s?.token) {
      router.replace('/agent/login');
      return;
    }
    if (!s.mustResetPassword) {
      router.replace('/agent/onboarded');
      return;
    }
    setLocalSession(s);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await setAgentPassword(newPassword, confirmPassword, session.token);
      setAgentSession({ mustResetPassword: false });
      router.replace('/agent/onboarded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  if (!session) return null;

  return (
    <main className="auth-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-elevation-2">
          <span className="font-display text-lg font-bold">L</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground dark:text-slate-100">Set your password</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground dark:text-slate-400">
          You signed in with a temporary password. Choose a new one to finish setting up your account.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-elevation-3 dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Save password & continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
