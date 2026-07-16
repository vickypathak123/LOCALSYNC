'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { ActivityEvent } from '@/lib/activity';
import { APPROACH_RADIUS_MULTIPLIER, deriveAgentStatus } from '@/lib/agentStatus';
import { formatEta, isToday, timeAgo } from '@/lib/format';
import type { Agent, TaskStatus, TaskUI } from '@/lib/types';
import Avatar from './Avatar';
import { PriorityBadge } from './StatusBadge';
import ThemeToggle from './ThemeToggle';
import {
  ActivityIcon,
  BellIcon,
  ChartIcon,
  CheckCircleIcon,
  ClockIcon,
  MenuIcon,
  NavigationIcon,
  PlusCircleIcon,
  TaskIcon,
  UsersIcon,
} from './icons';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-slate-800" />,
});

const ACTIVE_STATUSES: TaskStatus[] = ['pending', 'accepted', 'in_progress', 'reached'];

interface DashboardHomeProps {
  ownerName?: string;
  orgName?: string;
  agents: Agent[];
  tasksById: Record<string, TaskUI>;
  events: ActivityEvent[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenMenu: () => void;
  onOpenLive: () => void;
  onAssignTask: () => void;
  onInviteAgent: () => void;
  onViewReports: () => void;
  onViewTasks: () => void;
  onViewAgents: () => void;
  onSelectAgent: (agentId: string) => void;
}

interface TimelineItem {
  id: string;
  title: string;
  timestamp: number;
  tone: 'green' | 'amber' | 'blue' | 'slate' | 'red';
}

const TONE_CLASSES: Record<TimelineItem['tone'], string> = {
  green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  blue: 'bg-blue-100 text-primary dark:bg-blue-950 dark:text-blue-400',
  slate: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function taskStatusLabel(task: TaskUI): { label: string; classes: string } {
  if (
    task.status === 'in_progress' &&
    task.distance !== undefined &&
    task.distance <= task.radiusMeters * APPROACH_RADIUS_MULTIPLIER
  ) {
    return { label: 'Approaching', classes: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400' };
  }

  const labels: Record<TaskStatus, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    reached: 'On Site',
    completed: 'Completed',
    rejected: 'Rejected',
  };
  const classes: Record<TaskStatus, string> = {
    pending: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    accepted: 'bg-blue-100 text-primary dark:bg-blue-950 dark:text-blue-400',
    in_progress: 'bg-blue-100 text-primary dark:bg-blue-950 dark:text-blue-400',
    reached: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    completed: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
  };
  return { label: labels[task.status], classes: classes[task.status] };
}

function buildTimeline(tasks: TaskUI[], agents: Agent[], events: ActivityEvent[]): TimelineItem[] {
  const nameFor = (agentId: string) => agents.find((agent) => agent.agentId === agentId)?.name || 'Agent';
  const taskEvents = tasks.flatMap<TimelineItem>((task) => {
    const agentName = nameFor(task.agentId);
    const title = task.description || `Task #${task.taskId.slice(0, 6)}`;
    const items: TimelineItem[] = [
      { id: `${task.taskId}-created`, title: `${agentName} was assigned ${title}`, timestamp: task.createdAt, tone: 'blue' },
    ];
    if (task.acceptedAt) {
      items.push({ id: `${task.taskId}-accepted`, title: `${agentName} accepted ${title}`, timestamp: task.acceptedAt, tone: 'blue' });
    }
    if (task.reachedAt) {
      items.push({ id: `${task.taskId}-reached`, title: `${agentName} reached the destination`, timestamp: task.reachedAt, tone: 'amber' });
    }
    if (task.completedAt) {
      items.push({
        id: `${task.taskId}-completed`,
        title: `${agentName} completed ${title}${task.geoVerified ? ' — Geo Verified' : ''}`,
        timestamp: task.completedAt,
        tone: task.geoVerified ? 'green' : 'amber',
      });
    }
    if (task.rejectedAt) {
      items.push({ id: `${task.taskId}-rejected`, title: `${agentName} rejected ${title}`, timestamp: task.rejectedAt, tone: 'red' });
    }
    return items;
  });

  const liveEvents: TimelineItem[] = events.map((event) => ({
    id: `live-${event.id}`,
    title: `${event.agentName} · ${event.title}${event.detail ? ` — ${event.detail}` : ''}`,
    timestamp: event.timestamp,
    tone: event.dotClass.includes('rejected') ? 'red' : event.dotClass.includes('busy') ? 'amber' : event.dotClass.includes('verified') ? 'green' : 'blue',
  }));

  return [...liveEvents, ...taskEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-7" aria-label="Loading dashboard" role="status">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[122px] animate-pulse rounded-2xl border border-border bg-white dark:bg-slate-900" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-[142px] animate-pulse rounded-2xl border border-border bg-white dark:bg-slate-900" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.95fr)]">
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-white dark:bg-slate-900" />
        <div className="h-80 animate-pulse rounded-2xl border border-border bg-white dark:bg-slate-900" />
      </div>
    </div>
  );
}

export default function DashboardHome({
  ownerName,
  orgName,
  agents,
  tasksById,
  events,
  unreadCount,
  loading,
  error,
  onRetry,
  onOpenMenu,
  onOpenLive,
  onAssignTask,
  onInviteAgent,
  onViewReports,
  onViewTasks,
  onViewAgents,
  onSelectAgent,
}: DashboardHomeProps) {
  const tasks = useMemo(() => Object.values(tasksById), [tasksById]);
  const activeTasks = useMemo(
    () => tasks.filter((task) => ACTIVE_STATUSES.includes(task.status)).sort((a, b) => b.createdAt - a.createdAt),
    [tasks]
  );
  const availableAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const task = agent.currentTaskId ? tasksById[agent.currentTaskId] : undefined;
        return !agent.isArchived && agent.accountStatus === 'active' && deriveAgentStatus(agent, task).key === 'available';
      }),
    [agents, tasksById]
  );
  const completedToday = useMemo(
    () => tasks.filter((task) => task.status === 'completed' && !!task.completedAt && isToday(task.completedAt)),
    [tasks]
  );
  const timeline = useMemo(() => buildTimeline(tasks, agents, events), [tasks, agents, events]);

  const onlineCount = agents.filter((agent) => agent.online).length;
  const approachingCount = activeTasks.filter(
    (task) => task.distance !== undefined && task.distance <= task.radiusMeters * APPROACH_RADIUS_MULTIPLIER
  ).length;
  const verifiedCount = completedToday.filter((task) => task.geoVerified).length;
  const verifiedPercent = completedToday.length ? Math.round((verifiedCount / completedToday.length) * 100) : 0;
  const responseTimes = tasks
    .filter((task) => task.acceptedAt && task.acceptedAt >= task.createdAt)
    .map((task) => ((task.acceptedAt as number) - task.createdAt) / 60000);
  const averageResponse = responseTimes.length
    ? `${(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length).toFixed(1)} min`
    : '—';

  const dateLabel = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  const kpis = [
    {
      label: 'Total Agents',
      value: agents.length.toString(),
      detail: `${onlineCount} online`,
      detailClass: 'text-emerald-600',
      icon: <UsersIcon className="h-6 w-6" />,
      iconClass: 'bg-blue-50 text-primary dark:bg-blue-950',
    },
    {
      label: 'Active Tasks',
      value: activeTasks.length.toString(),
      detail: approachingCount ? `${approachingCount} approaching` : 'All operations nominal',
      detailClass: approachingCount ? 'text-amber-600' : 'text-emerald-600',
      icon: <TaskIcon className="h-6 w-6" />,
      iconClass: 'bg-blue-50 text-primary dark:bg-blue-950',
    },
    {
      label: 'Completed Today',
      value: completedToday.length.toString(),
      detail: completedToday.length ? `${verifiedPercent}% geo-verified` : 'No completions yet',
      detailClass: 'text-emerald-600',
      icon: <CheckCircleIcon className="h-6 w-6" />,
      iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950',
    },
    {
      label: 'Avg Response Time',
      value: averageResponse,
      detail: responseTimes.length ? `${responseTimes.length} accepted task${responseTimes.length === 1 ? '' : 's'}` : 'Awaiting response data',
      detailClass: responseTimes.length ? 'text-emerald-600' : 'text-muted-foreground',
      icon: <ClockIcon className="h-6 w-6" />,
      iconClass: 'bg-blue-50 text-primary dark:bg-blue-950',
    },
  ];

  const actions = [
    {
      title: 'Open Live Operations',
      description: 'Monitor agents in real-time',
      icon: <NavigationIcon className="h-5 w-5" />,
      iconClass: 'bg-blue-50 text-primary dark:bg-blue-950',
      onClick: onOpenLive,
    },
    {
      title: 'Assign New Task',
      description: 'Create and dispatch a task',
      icon: <PlusCircleIcon className="h-5 w-5" />,
      iconClass: 'bg-blue-50 text-primary dark:bg-blue-950',
      onClick: onAssignTask,
    },
    {
      title: 'Invite Agent',
      description: 'Add a new field agent',
      icon: <UsersIcon className="h-5 w-5" />,
      iconClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950',
      onClick: onInviteAgent,
    },
    {
      title: 'View Reports',
      description: 'Review performance data',
      icon: <ChartIcon className="h-5 w-5" />,
      iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-950',
      onClick: onViewReports,
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F6F8FC] dark:bg-slate-950">
      <header className="sticky top-0 z-[800] flex min-h-[92px] items-center border-b border-transparent bg-[#F6F8FC]/95 px-4 backdrop-blur sm:px-6 lg:px-10 dark:bg-slate-950/95">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-muted-foreground shadow-card lg:hidden dark:bg-slate-900"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl dark:text-white">
            {greeting()}, {ownerName?.split(' ')[0] || 'Owner'}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{orgName || 'Your organization'} · {dateLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-600 shadow-card sm:inline-flex dark:border-slate-700 dark:bg-slate-900">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live
          </span>
          <ThemeToggle />
          <button
            type="button"
            onClick={onOpenLive}
            aria-label="Open notifications in live operations"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-white dark:hover:bg-slate-900"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#F6F8FC]" />}
          </button>
          <span className="hidden text-xs text-slate-400 md:inline">Live data synced</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1540px] space-y-7 px-4 pb-10 sm:px-6 lg:px-10">
        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            <span>{error}</span>
            <button type="button" onClick={onRetry} className="min-h-10 rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700">
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <Card key={kpi.label} className="flex min-h-[122px] items-center gap-5 p-5 sm:p-6">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${kpi.iconClass}`}>{kpi.icon}</div>
                  <div className="min-w-0">
                    <p className="font-display text-[28px] font-bold leading-none tracking-tight text-foreground dark:text-white">{kpi.value}</p>
                    <p className="mt-2 text-sm font-medium text-slate-500">{kpi.label}</p>
                    <p className={`mt-0.5 truncate text-xs font-semibold ${kpi.detailClass}`}>{kpi.detail}</p>
                  </div>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {actions.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  onClick={action.onClick}
                  className="group min-h-[142px] rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevation-2 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-full ${action.iconClass}`}>{action.icon}</span>
                  <span className="mt-4 block text-sm font-bold text-foreground group-hover:text-primary dark:text-white">{action.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{action.description}</span>
                </button>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.95fr)]">
              <div className="space-y-5">
                <Card>
                  <div className="flex items-center justify-between px-5 pb-3 pt-5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-base font-bold">Active Tasks</h2>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-primary dark:bg-blue-950">{activeTasks.length} in progress</span>
                    </div>
                    <button type="button" onClick={onViewTasks} className="min-h-9 px-1 text-xs font-bold text-primary hover:underline">View All</button>
                  </div>
                  {activeTasks.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-8 text-center">
                      <TaskIcon className="h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold">No active tasks</p>
                      <p className="mt-1 text-xs text-muted-foreground">New assignments will appear here.</p>
                      <button type="button" onClick={onAssignTask} className="mt-4 min-h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-white">Assign a task</button>
                    </div>
                  ) : (
                    <ul className="px-5 pb-3 sm:px-6">
                      {activeTasks.slice(0, 3).map((task) => {
                        const agent = agents.find((item) => item.agentId === task.agentId);
                        const status = taskStatusLabel(task);
                        return (
                          <li key={task.taskId} className="grid gap-3 border-b border-slate-100 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:border-slate-800">
                            <div className="flex min-w-0 gap-3">
                              <span className={`w-1 shrink-0 rounded-full ${task.priority === 'urgent' || task.priority === 'high' ? 'bg-amber-500' : 'bg-primary'}`} />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-foreground dark:text-white">{task.description || `Task #${task.taskId.slice(0, 6)}`}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">{agent?.name || 'Unassigned agent'} · {task.destLat.toFixed(4)}, {task.destLng.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 pl-4 sm:justify-end sm:pl-0">
                              <PriorityBadge priority={task.priority} />
                              <span className="text-xs font-medium text-slate-500">ETA: {task.eta !== undefined ? formatEta(task.eta) : '—'}</span>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${status.classes}`}>{status.label}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card>
                  <div className="flex items-center justify-between px-5 pb-2 pt-5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <ActivityIcon className="h-5 w-5 text-foreground" />
                      <h2 className="font-display text-base font-bold">Recent Activity</h2>
                    </div>
                    <button type="button" onClick={onOpenLive} className="min-h-9 px-1 text-xs font-bold text-primary hover:underline">View All</button>
                  </div>
                  {timeline.length === 0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
                      <ActivityIcon className="h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold">No recent activity</p>
                      <p className="mt-1 text-xs text-muted-foreground">Agent and task events will appear here.</p>
                    </div>
                  ) : (
                    <ul className="px-5 pb-4 sm:px-6">
                      {timeline.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TONE_CLASSES[item.tone]}`}>
                            <CheckCircleIcon className="h-4 w-4" />
                          </span>
                          <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700 sm:text-sm dark:text-slate-200">{item.title}</p>
                          <time className="shrink-0 text-[11px] text-slate-400">{timeAgo(item.timestamp)}</time>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="space-y-5">
                <Card>
                  <div className="flex items-center justify-between px-5 pb-2 pt-5">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-base font-bold">Available Agents</h2>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950">{availableAgents.length} ready</span>
                    </div>
                    <button type="button" onClick={onViewAgents} className="min-h-9 px-1 text-xs font-bold text-primary hover:underline">View All</button>
                  </div>
                  {availableAgents.length === 0 ? (
                    <div className="flex min-h-44 flex-col items-center justify-center px-6 py-8 text-center">
                      <UsersIcon className="h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-sm font-semibold">No available agents</p>
                      <p className="mt-1 text-xs text-muted-foreground">Online agents ready for work will appear here.</p>
                    </div>
                  ) : (
                    <ul className="px-5">
                      {availableAgents.slice(0, 3).map((agent) => (
                        <li key={agent.agentId} className="flex items-center gap-3 border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
                          <Avatar name={agent.name} size="md" />
                          <button type="button" onClick={() => onSelectAgent(agent.agentId)} className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-bold text-foreground hover:text-primary dark:text-white">{agent.name}</span>
                            <span className="block text-[11px] font-medium text-muted-foreground">AGT-{agent.agentId.slice(0, 4).toUpperCase()}</span>
                            <span className="mt-1 block text-[11px] text-slate-400">{agent.lat || agent.lng ? `${agent.lat.toFixed(3)}, ${agent.lng.toFixed(3)}` : 'Awaiting GPS location'}</span>
                          </button>
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Available
                            </span>
                            <span className="mt-2 block text-[10px] text-slate-400">{agent.updatedAt ? `Synced ${timeAgo(agent.updatedAt)}` : 'Not synced yet'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="p-5 pt-3">
                    <button type="button" onClick={onInviteAgent} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 transition hover:border-primary/40 hover:text-primary dark:border-slate-700">
                      <UsersIcon className="h-4 w-4" /> Invite Agent
                    </button>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 px-5 pb-3 pt-5">
                    <h2 className="font-display text-base font-bold">Live Operations</h2>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live</span>
                  </div>
                  <div className="mx-5 h-60 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                    <MapView
                      agents={agents}
                      tasksById={tasksById}
                      selectedAgentId={null}
                      onSelectAgent={onSelectAgent}
                      pickMode={false}
                      pickedLocation={null}
                      onPickLocation={() => undefined}
                    />
                  </div>
                  <p className="px-5 py-4 text-xs font-medium text-slate-500">{onlineCount} agents online · {activeTasks.length} active tasks</p>
                  <div className="px-5 pb-5">
                    <button type="button" onClick={onOpenLive} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-elevation-1 transition hover:bg-primary-hover">
                      <NavigationIcon className="h-4 w-4" /> Open Live Operations
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
