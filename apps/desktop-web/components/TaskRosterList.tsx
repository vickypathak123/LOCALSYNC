'use client';

import type { Agent, TaskUI } from '@/lib/types';
import Avatar from './Avatar';
import DelayStatusBadge from './DelayStatusBadge';
import { SearchIcon, TaskIcon } from './icons';
import { TaskStatusBadge, PriorityBadge } from './StatusBadge';
import { formatDistance } from '@/lib/format';
import { useNowTick } from '@/lib/useNowTick';

interface TaskRosterListProps {
  tasks: TaskUI[];
  agents: Agent[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewTask: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export default function TaskRosterList({
  tasks,
  agents,
  selectedTaskId,
  onSelectTask,
  onNewTask,
  searchQuery,
  onSearchChange,
}: TaskRosterListProps) {
  const agentName = (agentId: string) => agents.find((a) => a.agentId === agentId)?.name || agentId.slice(0, 8);
  const sorted = [...tasks].sort((a, b) => b.createdAt - a.createdAt);
  const now = useNowTick();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="space-y-2 border-b border-border p-3 dark:border-slate-800">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Find task…"
            className="w-full rounded-lg border border-border bg-muted/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="button"
          onClick={onNewTask}
          className="w-full cursor-pointer rounded-lg bg-primary py-2 text-sm font-semibold text-on-primary shadow-elevation-1 transition-colors hover:bg-primary-hover"
        >
          + New Task
        </button>
      </div>

      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
        Tasks ({sorted.length})
      </p>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
        {sorted.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <TaskIcon className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground dark:text-slate-100">No tasks yet</p>
            <p className="text-xs text-muted-foreground dark:text-slate-400">
              Dispatch a task to get started.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {sorted.map((task) => {
              const selected = task.taskId === selectedTaskId;
              return (
                <li key={task.taskId}>
                  <button
                    type="button"
                    onClick={() => onSelectTask(task.taskId)}
                    className={`w-full cursor-pointer rounded-lg border p-2.5 text-left transition-colors ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/30 hover:bg-muted dark:border-slate-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={agentName(task.agentId)} size="sm" />
                        <span className="truncate text-xs font-semibold text-foreground dark:text-slate-100">
                          {agentName(task.agentId)}
                        </span>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                    <p className="mb-1.5 line-clamp-2 text-xs text-muted-foreground dark:text-slate-400">
                      {task.description || 'No description'}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <TaskStatusBadge status={task.status} />
                        {(task.status === 'in_progress' || task.status === 'reached') && (
                          <DelayStatusBadge estimatedArrivalAt={task.estimatedArrivalAt} now={now} compact />
                        )}
                      </div>
                      {task.status === 'in_progress' && (task.route?.distanceMeters ?? task.distance) !== undefined && (
                        <span className="font-mono text-[11px] tabular-nums text-accent">
                          {formatDistance((task.route?.distanceMeters ?? task.distance)!)}
                        </span>
                      )}
                    </div>
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
