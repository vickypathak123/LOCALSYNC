'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAgentByEmail, ApiError } from '@/lib/api';
import { setAgentSession } from '@/lib/auth';

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPendingApproval(false);
    setLoading(true);

    try {
      const res = await loginAgentByEmail(email, password);
      setAgentSession({
        token: res.token,
        agentId: res.agentId,
        orgId: res.orgId,
        mustResetPassword: res.mustResetPassword,
      });
      router.replace(res.mustResetPassword ? '/agent/set-password' : '/agent/onboarded');
    } catch (err) {
      // pending_approval / rejected come back as a 403 with a specific accountStatus,
      // distinct from a plain wrong-password 401 — shown as an informational notice,
      // not a red error, since nothing the agent does here will fix it.
      if (err instanceof ApiError && err.accountStatus === 'pending_approval') {
        setIsPendingApproval(true);
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-elevation-2">
          <span className="font-display text-lg font-bold">L</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground dark:text-slate-100">LocalSync</h1>
        <p className="mt-1 text-sm text-muted-foreground dark:text-slate-400">Agent sign-in</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-elevation-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-4 text-sm text-muted-foreground dark:text-slate-400">
          Use the email and temporary password from your invite email. You'll be asked to set your own
          password right after.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && (
            <p
              role="alert"
              className={`text-sm font-medium ${isPendingApproval ? 'text-status-busy' : 'text-destructive'}`}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
