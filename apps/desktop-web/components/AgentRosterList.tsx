'use client';

import type { Agent, TaskUI } from '@/lib/types';
import Avatar from './Avatar';
import PendingApprovalQueue from './PendingApprovalQueue';
import { SearchIcon, UsersIcon } from './icons';
import { deriveAgentStatus } from '@/lib/agentStatus';
import { formatDistance } from '@/lib/format';

interface AgentRosterListProps {
  agents: Agent[];
  pendingApprovalAgents: Agent[];
  tasksById: Record<string, TaskUI>;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onApprove: (agentId: string) => Promise<void>;
  onReject: (agentId: string) => Promise<void>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export default function AgentRosterList({
  agents,
  pendingApprovalAgents,
  tasksById,
  selectedAgentId,
  onSelectAgent,
  onApprove,
  onReject,
  searchQuery,
  onSearchChange,
}: AgentRosterListProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border p-3 dark:border-slate-800">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Find agent…"
            className="w-full rounded-lg border border-border bg-muted/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <PendingApprovalQueue agents={pendingApprovalAgents} onApprove={onApprove} onReject={onReject} />

      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
        Agents ({agents.length})
      </p>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {agents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <UsersIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground dark:text-slate-100">No agents found</p>
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              Invite an agent or share your invite code to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {agents.map((agent) => {
              const task = agent.currentTaskId ? tasksById[agent.currentTaskId] : undefined;
              const status = deriveAgentStatus(agent, task);
              const selected = agent.agentId === selectedAgentId;
              const rosterDistance = task?.route?.distanceMeters ?? task?.distance;
              const showDistance = task?.status === 'in_progress' && rosterDistance !== undefined;

              return (
                <li key={agent.agentId}>
                  <button
                    type="button"
                    onClick={() => onSelectAgent(agent.agentId)}
                    className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? 'bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-muted dark:hover:bg-slate-800'
                    } ${agent.isArchived ? 'opacity-50' : ''}`}
                  >
                    <Avatar name={agent.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground dark:text-slate-100">
                        {agent.name}
                      </p>
                      {agent.isArchived ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-offline">
                          <span className="status-dot bg-status-offline" aria-hidden />
                          Inactive
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.textClass}`}>
                          <span className={`status-dot ${status.dotClass}`} aria-hidden />
                          {status.label}
                        </span>
                      )}
                    </div>
                    {showDistance && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground dark:text-slate-400">
                        {formatDistance(rosterDistance!)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
