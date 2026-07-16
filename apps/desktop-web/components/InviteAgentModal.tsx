'use client';

import { useState } from 'react';

interface InviteAgentModalProps {
  onClose: () => void;
  onSubmit: (payload: { email: string; name: string }) => Promise<void>;
}

export default function InviteAgentModal({ onClose, onSubmit }: InviteAgentModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit({ email, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-elevation-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg text-foreground dark:text-slate-100">Invite Agent</h2>
            <p className="text-sm text-muted-foreground dark:text-slate-400">
              We'll email them a temporary password to sign in and get started.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="agentName" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Full name
            </label>
            <input
              id="agentName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="agentEmail" className="mb-1 block text-xs font-medium text-foreground dark:text-slate-300">
              Email
            </label>
            <input
              id="agentEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sending invite…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
