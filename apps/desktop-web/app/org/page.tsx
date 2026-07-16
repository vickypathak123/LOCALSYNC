'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrg } from '@/lib/api';
import { getSession, setSession, clearSession, type Session } from '@/lib/auth';

export default function OrgPage() {
  const router = useRouter();
  const [session, setLocalSession] = useState<Session | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      router.replace('/login');
      return;
    }
    setLocalSession(s);
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setLoading(true);

    try {
      const res = await createOrg(name, session.token);
      // The register-time token predates the org (no orgId claim) — swap in the
      // fresh one /api/org/create returns so org-scoped endpoints work immediately.
      const updated = setSession({ orgId: res.orgId, inviteCode: res.inviteCode, token: res.token });
      setLocalSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!session?.inviteCode) return;
    navigator.clipboard.writeText(session.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleLogout() {
    clearSession();
    router.replace('/login');
  }

  if (!session) return null;

  return (
    <main className="auth-bg flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-on-primary shadow-elevation-2">
          <span className="font-display text-lg font-bold">L</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground dark:text-slate-100">
          {session.orgId ? 'Your Organization' : 'Create your Organization'}
        </h1>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground dark:text-slate-400">
          {session.orgId
            ? 'Share this invite code with agents so they can register.'
            : 'One org per owner — this sets up your dispatch workspace.'}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-elevation-3 dark:border-slate-800 dark:bg-slate-900">
        {session.orgId ? (
          <div className="space-y-5 text-center">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-slate-400">
                Invite Code
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="w-full cursor-pointer rounded-xl border border-dashed border-primary/40 bg-primary/5 py-4 font-mono text-3xl font-semibold tracking-[0.3em] text-primary transition-colors hover:bg-primary/10"
              >
                {session.inviteCode ?? '——————'}
              </button>
              <p className="mt-2 text-xs text-muted-foreground dark:text-slate-400">
                {copied ? 'Copied to clipboard' : 'Click to copy'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
                Organization name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Logistics"
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
              {loading ? 'Creating…' : 'Create Organization'}
            </button>
          </form>
        )}
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
