'use client';

import { useState } from 'react';
import type { Agent } from '@/lib/types';
import type { OrgInfo } from '@/lib/api';
import { BuildingIcon } from './icons';

interface OrgPanelProps {
  org: OrgInfo | null;
  agents: Agent[];
  onClose: () => void;
}

export default function OrgPanel({ org, agents, onClose }: OrgPanelProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!org) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const activeCount = agents.filter((a) => a.accountStatus === 'active').length;
  const invitedCount = agents.filter((a) => a.accountStatus === 'invited').length;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-elevation-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BuildingIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground dark:text-slate-100">
                {org?.name ?? 'Loading…'}
              </h2>
              <p className="text-xs text-muted-foreground dark:text-slate-400">Organization details</p>
            </div>
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

        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground dark:text-slate-400">
              Invite code
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="w-full cursor-pointer rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 font-mono text-2xl font-semibold tracking-[0.3em] text-primary transition-colors hover:bg-primary/10"
            >
              {org?.inviteCode ?? '——————'}
            </button>
            <p className="mt-2 text-xs text-muted-foreground dark:text-slate-400">
              {copied ? 'Copied to clipboard' : 'For self-registration (e.g. the Android app) — click to copy'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-white p-4 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="font-display text-xl font-bold text-foreground dark:text-slate-100">{agents.length}</p>
              <p className="text-xs text-muted-foreground dark:text-slate-400">Total agents</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="font-display text-xl font-bold text-status-verified">{activeCount}</p>
              <p className="text-xs text-muted-foreground dark:text-slate-400">Active</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-4 text-center shadow-card dark:border-slate-800 dark:bg-slate-900">
              <p className="font-display text-xl font-bold text-status-pending">{invitedCount}</p>
              <p className="text-xs text-muted-foreground dark:text-slate-400">Invited</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
