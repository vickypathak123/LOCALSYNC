'use client';

import { useMemo, useState } from 'react';
import type { DirectoryTaskItem, DirectoryTaskPriority, DirectoryTaskStatus } from '@/lib/taskDirectoryMock';
import { DIRECTORY_TASKS } from '@/lib/taskDirectoryMock';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import { CalendarIcon, ChevronDownIcon, CloseIcon, DotsIcon, MapPinIcon, MenuIcon, PlusCircleIcon, SearchIcon } from './icons';

interface TaskDirectoryProps {
  onOpenMenu: () => void;
  onCreateTask: () => void;
  onCancelTask: (task: DirectoryTaskItem) => void;
}

const STATUS_META: Record<DirectoryTaskStatus, { label: string; className: string }> = {
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  approaching: { label: 'Approaching', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  accepted: { label: 'Accepted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300' },
};

const PRIORITY_META: Record<DirectoryTaskPriority, string> = {
  Low: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300',
  Medium: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  High: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  Critical: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300',
};

function StatusBadge({ status }: { status: DirectoryTaskStatus }) {
  const meta = STATUS_META[status];
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>;
}

function PriorityBadge({ priority }: { priority: DirectoryTaskPriority }) {
  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${PRIORITY_META[priority]}`}>{priority}</span>;
}

function TaskDetails({ task, onClose, onCancel }: { task: DirectoryTaskItem; onClose: () => void; onCancel: () => void }) {
  const cancellable = !['completed', 'rejected'].includes(task.status);
  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex h-[68px] shrink-0 items-center justify-between border-b px-5 dark:border-slate-800">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Task Details</h2>
        <button type="button" onClick={onClose} aria-label="Close task details" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><CloseIcon className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-thin">
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-slate-500 dark:text-slate-400">{task.id}</span><span className="text-slate-300">•</span><PriorityBadge priority={task.priority} /><StatusBadge status={task.status} /></div>
        <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">{task.title}</h3>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Destination</h4>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex gap-3"><MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold text-slate-900 dark:text-white">{task.destination}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{task.address}</p></div></div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-xs dark:border-slate-700"><span className="text-slate-400">Coords: {task.coordinates}</span><span className="font-semibold text-primary">Geofence: {task.geofence}</span></div>
          </div>
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Assigned Agent</h4>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <div className="flex items-center gap-3"><Avatar name={task.agent.name} size="md" /><div><p className="font-bold text-slate-900 dark:text-white">{task.agent.name}</p><p className="text-xs text-slate-500">{task.agent.id}</p></div><span className="ml-auto rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-950/60 dark:text-blue-300">Busy</span></div>
            <div className="mt-3 flex justify-between border-t pt-3 text-sm dark:border-slate-700"><span className="text-slate-500">Distance: <strong className="text-slate-900 dark:text-white">{task.distance}</strong></span><span className="text-slate-500">ETA: <strong className="text-slate-900 dark:text-white">{task.eta}</strong></span></div>
          </div>
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Timeline</h4>
          <ol className="mt-3 space-y-3">
            {task.timeline.map((item, index) => (
              <li key={`${task.id}-${item.label}`} className="relative flex items-center gap-3 text-sm">
                {index < task.timeline.length - 1 && <span className={`absolute left-[5px] top-4 h-5 border-l-2 ${item.state === 'pending' ? 'border-dotted border-slate-200 dark:border-slate-700' : 'border-primary'}`} />}
                <span className={`relative z-10 h-3 w-3 shrink-0 rounded-full border-2 ${item.state === 'complete' ? 'border-emerald-500 bg-emerald-500' : item.state === 'current' ? 'border-primary bg-primary' : 'border-slate-400 bg-white dark:bg-slate-900'}`} />
                <span className={`font-medium ${item.state === 'current' ? 'text-primary' : item.state === 'pending' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>{item.label}</span><span className="ml-auto text-xs text-slate-400">{item.time}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Geo Verification</h4>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/70">
            <dt className="text-slate-500">Status:</dt><dd className="text-right font-semibold text-slate-700 dark:text-slate-200">{task.geoVerification.status}</dd>
            <dt className="text-slate-500">Method:</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{task.geoVerification.method}</dd>
            <dt className="text-slate-500">Required Accuracy:</dt><dd className="text-right font-bold text-slate-900 dark:text-white">{task.geoVerification.accuracy}</dd>
          </dl>
        </section>
      </div>

      <div className="shrink-0 border-t p-5 dark:border-slate-800"><button type="button" onClick={onCancel} disabled={!cancellable} className="min-h-11 w-full rounded-xl bg-red-100 px-4 text-sm font-bold text-red-600 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950">{cancellable ? 'Cancel Task' : 'Task Closed'}</button></div>
    </div>
  );
}

export default function TaskDirectory({ onOpenMenu, onCreateTask, onCancelTask }: TaskDirectoryProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | DirectoryTaskStatus>('all');
  const [priority, setPriority] = useState<'all' | DirectoryTaskPriority>('all');
  const [period, setPeriod] = useState<'all' | 'today' | 'yesterday'>('all');
  const [selectedId, setSelectedId] = useState('TSK-101');
  const [detailsOpen, setDetailsOpen] = useState(true);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return DIRECTORY_TASKS.filter((task) => {
      const matchesQuery = !normalizedQuery || task.id.toLowerCase().includes(normalizedQuery) || task.title.toLowerCase().includes(normalizedQuery) || task.agent.name.toLowerCase().includes(normalizedQuery);
      return matchesQuery && (status === 'all' || task.status === status) && (priority === 'all' || task.priority === priority) && (period === 'all' || task.createdPeriod === period);
    });
  }, [period, priority, query, status]);
  const selectedTask = DIRECTORY_TASKS.find((task) => task.id === selectedId) ?? DIRECTORY_TASKS[0];
  const activeCount = DIRECTORY_TASKS.filter((task) => ['in_progress', 'approaching', 'accepted'].includes(task.status)).length;

  function selectTask(id: string) { setSelectedId(id); setDetailsOpen(true); }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#F6F8FC] dark:bg-slate-950">
      <section className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onOpenMenu} aria-label="Open navigation" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-card lg:hidden dark:border-slate-700 dark:bg-slate-900"><MenuIcon className="h-5 w-5" /></button>
          <div><h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Tasks</h1><p className="text-sm text-slate-500 dark:text-slate-400">{DIRECTORY_TASKS.length} total · {activeCount} active</p></div>
          <div className="ml-auto flex items-center gap-2"><ThemeToggle /><button type="button" onClick={onCreateTask} className="flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-white shadow-card transition hover:bg-primary-hover sm:px-5"><PlusCircleIcon className="h-4 w-4" /><span className="hidden sm:inline">Create Task</span><span className="sm:hidden">Create</span></button></div>
        </header>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_152px_164px_135px]">
          <label className="relative"><span className="sr-only">Search tasks</span><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-card outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white" /></label>
          <FilterSelect label="Filter by status" value={status} onChange={(value) => setStatus(value as 'all' | DirectoryTaskStatus)}><option value="all">All Statuses</option><option value="in_progress">In Progress</option><option value="approaching">Approaching</option><option value="accepted">Accepted</option><option value="completed">Completed</option><option value="rejected">Rejected</option></FilterSelect>
          <FilterSelect label="Filter by priority" value={priority} onChange={(value) => setPriority(value as 'all' | DirectoryTaskPriority)}><option value="all">All Priorities</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></FilterSelect>
          <FilterSelect label="Filter by date" value={period} onChange={(value) => setPeriod(value as 'all' | 'today' | 'yesterday')} icon><option value="all">All Dates</option><option value="today">Today</option><option value="yesterday">Yesterday</option></FilterSelect>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-[68px_minmax(0,1fr)_100px] gap-3 border-b bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-500 xl:grid-cols-[78px_minmax(130px,1.3fr)_150px_82px_104px_72px_62px_78px_36px] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"><span>Task ID</span><span>Title</span><span className="hidden xl:block">Assigned Agent</span><span className="hidden xl:block">Priority</span><span>Status</span><span className="hidden xl:block">Distance</span><span className="hidden xl:block">ETA</span><span className="hidden xl:block">Created</span><span className="hidden xl:block">Actions</span></div>
          {filteredTasks.length ? <ul>{filteredTasks.map((task) => { const selected = detailsOpen && selectedId === task.id; return <li key={task.id} className="border-b last:border-0 dark:border-slate-800"><button type="button" onClick={() => selectTask(task.id)} className={`grid min-h-[58px] w-full grid-cols-[68px_minmax(0,1fr)_100px] items-center gap-3 px-4 text-left transition xl:grid-cols-[78px_minmax(130px,1.3fr)_150px_82px_104px_72px_62px_78px_36px] ${selected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}><span className="truncate text-xs font-semibold text-primary sm:text-sm">{task.id}</span><span className="truncate text-sm font-medium text-slate-900 dark:text-white">{task.title}</span><span className="hidden min-w-0 items-center gap-2 xl:flex"><Avatar name={task.agent.name} size="sm" /><span className="truncate text-sm text-slate-800 dark:text-slate-200">{task.agent.name}</span></span><span className="hidden xl:block"><PriorityBadge priority={task.priority} /></span><span><StatusBadge status={task.status} /></span><span className="hidden text-sm text-slate-700 xl:block dark:text-slate-300">{task.distance}</span><span className="hidden text-sm text-slate-700 xl:block dark:text-slate-300">{task.eta}</span><span className="hidden text-sm text-slate-500 xl:block">{task.created}</span><span className="hidden text-slate-400 xl:block"><DotsIcon className="h-5 w-5" /></span></button></li>; })}</ul> : <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><SearchIcon className="h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-900 dark:text-white">No tasks found</p><p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p></div>}
          <footer className="flex items-center justify-between border-t px-4 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400"><span>Showing {filteredTasks.length} of {DIRECTORY_TASKS.length} tasks</span><div className="hidden gap-2 sm:flex"><button type="button" disabled className="rounded-lg border px-3 py-1.5 opacity-50">Previous</button><button type="button" disabled className="rounded-lg border px-3 py-1.5 opacity-50">Next</button></div></footer>
        </div>
      </section>

      {detailsOpen && <><button type="button" aria-label="Close task details" onClick={() => setDetailsOpen(false)} className="fixed inset-0 z-[890] bg-slate-950/35 min-[1700px]:hidden" /><aside className="fixed inset-y-0 right-0 z-[900] w-[min(474px,100vw)] border-l border-slate-200 shadow-elevation-4 min-[1700px]:static min-[1700px]:z-auto min-[1700px]:w-[474px] min-[1700px]:shrink-0 min-[1700px]:shadow-none dark:border-slate-800"><TaskDetails task={selectedTask} onClose={() => setDetailsOpen(false)} onCancel={() => onCancelTask(selectedTask)} /></aside></>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, icon = false, children }: { label: string; value: string; onChange: (value: string) => void; icon?: boolean; children: React.ReactNode }) {
  return <label className="relative"><span className="sr-only">{label}</span>{icon && <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />}<select value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-9 text-sm font-semibold text-slate-700 shadow-card outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${icon ? 'pl-9' : 'pl-4'}`}>{children}</select><ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>;
}
