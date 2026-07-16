'use client';

import { useState } from 'react';
import { loginOwner, registerOwner } from '@/lib/api';

interface AuthFormsProps {
  onSuccess: (session: { token: string; ownerId: string; orgId: string; ownerName: string }) => void;
}

type Mode = 'login' | 'register';

export default function AuthForms({ onSuccess }: AuthFormsProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await loginOwner(email, password);
        onSuccess({ token: res.token, ownerId: res.ownerId, orgId: res.orgId, ownerName: res.name });
      } else {
        const res = await registerOwner(email, password, name);
        onSuccess({ token: res.token, ownerId: res.ownerId, orgId: '', ownerName: res.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-elevation-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex rounded-lg bg-muted p-1 dark:bg-slate-800">
        {(['login', 'register'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 cursor-pointer rounded-md py-1.5 text-sm font-semibold transition-colors ${
              mode === m
                ? 'bg-white text-primary shadow-card dark:bg-slate-950 dark:text-secondary'
                : 'text-muted-foreground hover:text-foreground dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {m === 'login' ? 'Log in' : 'Register'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
          {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
