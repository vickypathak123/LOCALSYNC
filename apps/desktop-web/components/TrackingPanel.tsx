'use client';

import type { Agent, TaskUI } from '@/lib/types';
import Avatar from './Avatar';
import DelayStatusBadge from './DelayStatusBadge';
import { AccountStatusBadge, PriorityBadge, TaskStatusBadge } from './StatusBadge';
import { deriveAgentStatus } from '@/lib/agentStatus';
import { formatDistance, formatEta, formatClockTime, timeAgo } from '@/lib/format';
import { useNowTick } from '@/lib/useNowTick';
import { ClockIcon, EditIcon, ArchiveIcon, TrashIcon, RefreshIcon } from './icons';

interface TrackingPanelProps {
  agent: Agent;
  task?: TaskUI;
  onClose: () => void;
  onAssignTask: () => void;
  onViewHistory: () => void;
  onEdit: () => void;
  onResendInvite: () => Promise<void>;
  onToggleArchive: () => Promise<void>;
  onDelete: () => void;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting acceptance',
  accepted: 'Accepted · not yet moving',
  rejected: 'Rejected by agent',
  in_progress: 'In progress',
  reached: 'Destination reached',
  completed: 'Completed',
};

function TelemetryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
      <span className="text-xs text-muted-foreground dark:text-slate-400">{label}</span>
      <span className="font-mono text-xs font-medium tabular-nums text-foreground dark:text-slate-100">{value}</span>
    </div>
  );
}

function TaskTimelineRow({ label, timestamp }: { label: string; timestamp: number | null }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={timestamp ? 'text-foreground dark:text-slate-200' : 'text-muted-foreground/50 dark:text-slate-600'}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${timestamp ? 'text-muted-foreground dark:text-slate-400' : 'text-muted-foreground/50 dark:text-slate-600'}`}>
        {timestamp ? new Date(timestamp).toLocaleTimeString() : '—'}
      </span>
    </div>
  );
}

// Owners are tracking an order/task, not a person — when there's an active (or
// recently active) task, the panel leads with the task and folds the agent in
// as "who's handling it." With no task at all (an available/offline agent with
// nothing assigned), it falls back to an agent-only view.
export default function TrackingPanel({
  agent,
  task,
  onClose,
  onAssignTask,
  onViewHistory,
  onEdit,
  onResendInvite,
  onToggleArchive,
  onDelete,
}: TrackingPanelProps) {
  const status = deriveAgentStatus(agent, task);
  const canDispatch = agent.online && agent.status === 'available' && !agent.isArchived;
  const now = useNowTick();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4 dark:border-slate-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
          {task ? 'Task Details' : 'Agent Details'}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tracking panel"
          className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted dark:hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {task ? (
          <>
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground dark:text-slate-400">
                TK-{task.taskId.slice(0, 6).toUpperCase()}
              </p>
              <PriorityBadge priority={task.priority} />
            </div>
            <p className="mt-1 font-display text-lg font-bold text-foreground dark:text-slate-100">
              {task.description || 'Untitled task'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={task.status} />
              {(task.status === 'in_progress' || task.status === 'reached') && (
                <DelayStatusBadge estimatedArrivalAt={task.estimatedArrivalAt} now={now} />
              )}
            </div>

            {(() => {
              // Prefer the persisted road route (survives a refresh — it's
              // read straight from Redis) over the live Haversine distance/eta,
              // which is session-only and briefly empty right after a reload
              // until the next location tick lands. Fall back to Haversine when
              // no route has been computed yet (no provider configured, or too
              // early in the task's life for one to exist).
              const distanceMeters = task.route?.distanceMeters ?? task.distance;
              const etaSeconds = task.route?.durationSeconds ?? task.eta;
              const showMetrics = (task.status === 'in_progress' || task.status === 'reached') && distanceMeters !== undefined;

              if (!showMetrics) {
                return (
                  <p className="mt-3 text-xs font-medium text-muted-foreground dark:text-slate-400">
                    {TASK_STATUS_LABEL[task.status] ?? task.status}
                  </p>
                );
              }

              return (
                <div className="mt-4 rounded-xl border border-border bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="font-display text-lg font-bold text-foreground dark:text-slate-100">
                        {formatDistance(distanceMeters)}
                      </p>
                      <p className="text-[11px] text-muted-foreground dark:text-slate-400">
                        {task.route ? 'Road distance' : 'Distance (straight-line)'}
                      </p>
                    </div>
                    <div>
                      <p className="font-display text-lg font-bold text-foreground dark:text-slate-100">
                        {etaSeconds !== undefined ? formatEta(etaSeconds) : '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground dark:text-slate-400">ETA</p>
                    </div>
                  </div>
                  {/* Fixed at acceptance time (acceptedAt + first known ETA) and
                      never recalculated — this is what makes it a stable target
                      to measure lateness against, instead of a live estimate
                      that always reads "on time" because it keeps re-anchoring
                      to the current moment. */}
                  {task.estimatedArrivalAt && (
                    <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground dark:border-slate-800 dark:text-slate-400">
                      Estimated arrival{' '}
                      <span className="font-mono font-medium text-foreground dark:text-slate-100">
                        {formatClockTime(new Date(task.estimatedArrivalAt))}
                      </span>
                    </p>
                  )}
                </div>
              );
            })()}

            {task.delayReason && (
              <div className="mt-3 rounded-xl border border-status-busy/30 bg-status-busy/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-status-busy">Delay Reason</p>
                <p className="mt-1 text-sm text-foreground dark:text-slate-100">{task.delayReason}</p>
              </div>
            )}

            <div className="mt-4 space-y-1.5 rounded-xl border border-border bg-white p-3.5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <TaskTimelineRow label="Assigned" timestamp={task.createdAt} />
              <TaskTimelineRow label="Accepted" timestamp={task.acceptedAt} />
              <TaskTimelineRow label="Reached" timestamp={task.reachedAt} />
              <TaskTimelineRow label="Completed" timestamp={task.completedAt} />
              {task.status === 'rejected' && <TaskTimelineRow label="Rejected" timestamp={task.rejectedAt} />}
            </div>

            <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
              Assigned Agent
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <Avatar name={agent.name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground dark:text-slate-100">{agent.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground dark:text-slate-400">
                  AGT-{agent.agentId.slice(0, 6).toUpperCase()}
                </p>
              </div>
              {agent.isArchived ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-offline/10 px-2 py-0.5 text-xs font-medium text-status-offline">
                  <span className="status-dot bg-status-offline" aria-hidden />
                  Inactive
                </span>
              ) : (
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.bgClass} ${status.textClass}`}>
                  <span className={`status-dot ${status.dotClass}`} aria-hidden />
                  {status.label}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={agent.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold text-foreground dark:text-slate-100">{agent.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground dark:text-slate-400">
                  AGT-{agent.agentId.slice(0, 6).toUpperCase()}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {agent.isArchived ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-offline/10 px-2 py-0.5 text-xs font-medium text-status-offline">
                  <span className="status-dot bg-status-offline" aria-hidden />
                  Inactive
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${status.bgClass} ${status.textClass}`}>
                  <span className={`status-dot ${status.dotClass}`} aria-hidden />
                  {status.label}
                </span>
              )}
              {agent.accountStatus !== 'active' && <AccountStatusBadge status={agent.accountStatus} />}
            </div>
          </>
        )}

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
            Live Telemetry
          </p>
          <div className="divide-y divide-border rounded-xl border border-border bg-white px-3.5 shadow-card dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            <TelemetryRow label="Last sync" value={agent.online ? timeAgo(agent.updatedAt) : '—'} />
            <TelemetryRow
              label="Coordinates"
              value={agent.online ? `${agent.lat.toFixed(4)}°, ${agent.lng.toFixed(4)}°` : '—'}
            />
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
            Actions
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={onAssignTask}
              disabled={!canDispatch}
              title={canDispatch ? undefined : 'Agent must be online and available to receive a task'}
              className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Assign New Task
            </button>
            <button
              type="button"
              onClick={onViewHistory}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ClockIcon className="h-4 w-4" />
              View Full History
            </button>

            <div className="flex items-center gap-1.5 pt-1">
              {agent.accountStatus === 'invited' && (
                <button
                  type="button"
                  onClick={() => onResendInvite()}
                  title="Resend invite"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-slate-800"
                >
                  <RefreshIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                title="Edit agent"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-slate-800"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onToggleArchive()}
                title={agent.isArchived ? 'Restore agent' : 'Archive agent'}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-slate-800"
              >
                <ArchiveIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title="Delete agent"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
