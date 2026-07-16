import type { AgentStatus, TaskStatus, AccountStatus, TaskPriority } from '@/lib/types';

const AGENT_STYLES: Record<'online' | 'offline' | AgentStatus, { dot: string; text: string; label: string }> = {
  online: { dot: 'bg-status-available', text: 'text-status-available', label: 'Online' },
  offline: { dot: 'bg-status-offline', text: 'text-status-offline', label: 'Offline' },
  available: { dot: 'bg-status-available', text: 'text-status-available', label: 'Available' },
  busy: { dot: 'bg-status-busy', text: 'text-status-busy', label: 'Busy' },
};

const TASK_STYLES: Record<TaskStatus | 'verified' | 'unverified', { dot: string; text: string; label: string }> = {
  pending: { dot: 'bg-status-pending', text: 'text-status-pending', label: 'Pending' },
  accepted: { dot: 'bg-status-progress', text: 'text-status-progress', label: 'Accepted' },
  rejected: { dot: 'bg-status-rejected', text: 'text-status-rejected', label: 'Rejected' },
  in_progress: { dot: 'bg-status-progress', text: 'text-status-progress', label: 'In Progress' },
  reached: { dot: 'bg-status-reached', text: 'text-status-reached', label: 'Destination Reached' },
  completed: { dot: 'bg-status-verified', text: 'text-status-verified', label: 'Completed' },
  verified: { dot: 'bg-status-verified', text: 'text-status-verified', label: 'Geo Verified' },
  unverified: { dot: 'bg-status-unverified', text: 'text-status-unverified', label: 'Not Geo Verified' },
};

export function AgentStatusBadge({ online, status }: { online: boolean; status: AgentStatus }) {
  const style = !online ? AGENT_STYLES.offline : AGENT_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className={`status-dot ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const style = TASK_STYLES[status];
  const pulsing = status === 'reached' || status === 'in_progress';
  return (
    <span className={`relative inline-flex items-center gap-1.5 text-xs font-medium ${style.text}`}>
      <span className="relative inline-flex h-2.5 w-2.5">
        {pulsing && <span className={`status-pulse ${style.dot}`} aria-hidden />}
        <span className={`status-dot relative ${style.dot}`} aria-hidden />
      </span>
      {style.label}
    </span>
  );
}

export function GeoVerifiedBadge({ verified }: { verified: boolean }) {
  const style = verified ? TASK_STYLES.verified : TASK_STYLES.unverified;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.text}`}>
      <span className={`status-dot ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

const ACCOUNT_STYLES: Record<AccountStatus, { bg: string; text: string; label: string }> = {
  invited: { bg: 'bg-status-pending/10', text: 'text-status-pending', label: 'Invited' },
  pending_approval: { bg: 'bg-status-busy/10', text: 'text-status-busy', label: 'Pending Approval' },
  active: { bg: 'bg-status-verified/10', text: 'text-status-verified', label: 'Active' },
  rejected: { bg: 'bg-status-rejected/10', text: 'text-status-rejected', label: 'Rejected' },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const style = ACCOUNT_STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

const PRIORITY_STYLES: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-slate-500/10', text: 'text-slate-500', label: 'Low' },
  medium: { bg: 'bg-primary/10', text: 'text-primary', label: 'Medium' },
  high: { bg: 'bg-status-busy/10', text: 'text-status-busy', label: 'High' },
  urgent: { bg: 'bg-destructive/10', text: 'text-destructive', label: 'Urgent' },
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const style = PRIORITY_STYLES[priority];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}
