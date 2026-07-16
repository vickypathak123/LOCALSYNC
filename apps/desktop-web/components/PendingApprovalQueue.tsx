'use client';

import { useState } from 'react';
import type { Agent } from '@/lib/types';
import Avatar from './Avatar';
import { BellIcon } from './icons';

interface PendingApprovalQueueProps {
  agents: Agent[];
  onApprove: (agentId: string) => Promise<void>;
  onReject: (agentId: string) => Promise<void>;
}

export default function PendingApprovalQueue({ agents, onApprove, onReject }: PendingApprovalQueueProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (agents.length === 0) return null;

  async function handle(action: (agentId: string) => Promise<void>, agentId: string) {
    setBusyId(agentId);
    try {
      await action(agentId);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="m-4 mb-0 rounded-xl border border-status-busy/30 bg-status-busy/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BellIcon className="h-4 w-4 text-status-busy" />
        <h3 className="text-sm font-semibold text-foreground dark:text-slate-100">
          Pending Approval <span className="text-status-busy">({agents.length})</span>
        </h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground dark:text-slate-400">
        These agents self-registered with your invite code and need approval before they can log in.
      </p>

      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.agentId}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={agent.name} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground dark:text-slate-100">{agent.name}</p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  Requested {new Date(agent.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyId === agent.agentId}
                onClick={() => handle(onReject, agent.agentId)}
                className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={busyId === agent.agentId}
                onClick={() => handle(onApprove, agent.agentId)}
                className="cursor-pointer rounded-md bg-status-verified px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyId === agent.agentId ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
