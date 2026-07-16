'use client';

import { useMemo, useState } from 'react';
import type { DirectoryAgent, DirectoryAgentStatus } from '@/lib/agentDirectoryMock';
import { DIRECTORY_AGENTS } from '@/lib/agentDirectoryMock';
import Avatar from './Avatar';
import ThemeToggle from './ThemeToggle';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  MapPinIcon,
  MenuIcon,
  SearchIcon,
  SignalIcon,
} from './icons';

interface AgentDirectoryProps {
  onOpenMenu: () => void;
  onInviteAgent: () => void;
  onAssignTask: () => void;
  onEditAgent: (agent: DirectoryAgent) => void;
}

const STATUS_STYLES: Record<DirectoryAgentStatus, { label: string; className: string; dot: string }> = {
  available: { label: 'Available', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', dot: 'bg-emerald-500' },
  busy: { label: 'Busy', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', dot: 'bg-blue-600' },
  approaching: { label: 'Approaching', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300', dot: 'bg-amber-500' },
  offline: { label: 'Offline', className: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-400' },
};

function StatusBadge({ status }: { status: DirectoryAgentStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${style.className}`}>
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

function AgentDetails({
  agent,
  onClose,
  onAssignTask,
  onEditAgent,
}: {
  agent: DirectoryAgent;
  onClose: () => void;
  onAssignTask: () => void;
  onEditAgent: (agent: DirectoryAgent) => void;
}) {
  const connected = agent.status !== 'offline';
  const telemetry = [
    { icon: MapPinIcon, label: 'Current Location:', value: agent.location },
    { icon: SignalIcon, label: 'GPS Accuracy:', value: agent.gpsAccuracy },
    { icon: SignalIcon, label: 'Connection:', value: connected ? 'Connected' : 'Disconnected', connected },
    { icon: ClockIcon, label: 'Online Duration:', value: agent.onlineDuration },
    { icon: ClockIcon, label: 'Last Sync:', value: agent.lastSync },
  ];

  return (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900">
      <div className="flex h-[68px] shrink-0 items-center justify-between border-b px-5 dark:border-slate-800">
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Agent Details</h2>
        <button type="button" onClick={onClose} aria-label="Close agent details" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
        <div className="flex flex-col items-center border-b pb-5 text-center dark:border-slate-800">
          <Avatar name={agent.name} size="lg" />
          <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">{agent.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{agent.id}</p>
          <div className="mt-2"><StatusBadge status={agent.status} /></div>
        </div>

        <section className="mt-5">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Telemetry</h4>
          <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
            {telemetry.map(({ icon: Icon, label, value, connected: connectionState }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="ml-auto text-right font-medium text-slate-800 dark:text-slate-100">
                  {connectionState !== undefined && <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${connectionState ? 'bg-emerald-500' : 'bg-slate-400'}`} />}
                  {value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Current Task</h4>
          {agent.task ? (
            <div className="mt-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="flex items-start justify-between gap-3 border-b pb-3 dark:border-slate-700">
                <p className="font-semibold text-slate-900 dark:text-white">{agent.task.title}</p>
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">{agent.task.priority}</span>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Destination</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{agent.task.destination}</dd>
                <dt className="text-slate-500">Distance</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{agent.task.distance}</dd>
                <dt className="text-slate-500">ETA</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{agent.task.eta}</dd>
                <dt className="text-slate-500">State</dt><dd className="text-right font-semibold text-primary">{agent.task.state}</dd>
              </dl>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No active task</div>
          )}
        </section>

        <section className="mt-6">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">Task History</h4>
          {agent.history.length ? (
            <ul className="mt-3 space-y-3">
              {agent.history.map((item) => (
                <li key={`${agent.id}-${item.title}`} className="flex gap-3">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.completedAt}</p></div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-500">No completed tasks yet.</p>}
        </section>
      </div>

      <div className="grid shrink-0 gap-2 border-t p-5 dark:border-slate-800">
        <button type="button" onClick={onAssignTask} className="min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-card transition hover:bg-primary-hover">Assign Task</button>
        <button type="button" onClick={() => onEditAgent(agent)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 transition hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-slate-300">Edit Agent</button>
      </div>
    </div>
  );
}

export default function AgentDirectory({ onOpenMenu, onInviteAgent, onAssignTask, onEditAgent }: AgentDirectoryProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | DirectoryAgentStatus>('all');
  const [region, setRegion] = useState('all');
  const [selectedId, setSelectedId] = useState('AGT-002');
  const [detailsOpen, setDetailsOpen] = useState(true);

  const regions = useMemo(() => [...new Set(DIRECTORY_AGENTS.map((agent) => agent.region))], []);
  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return DIRECTORY_AGENTS.filter((agent) => {
      const matchesQuery = !normalizedQuery || agent.name.toLowerCase().includes(normalizedQuery) || agent.id.toLowerCase().includes(normalizedQuery);
      return matchesQuery && (status === 'all' || agent.status === status) && (region === 'all' || agent.region === region);
    });
  }, [query, region, status]);
  const selectedAgent = DIRECTORY_AGENTS.find((agent) => agent.id === selectedId) ?? DIRECTORY_AGENTS[0];
  const onlineCount = DIRECTORY_AGENTS.filter((agent) => agent.status !== 'offline').length;

  function selectAgent(id: string) {
    setSelectedId(id);
    setDetailsOpen(true);
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#F6F8FC] dark:bg-slate-950">
      <section className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onOpenMenu} aria-label="Open navigation" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-card lg:hidden dark:border-slate-700 dark:bg-slate-900"><MenuIcon className="h-5 w-5" /></button>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Agents</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{DIRECTORY_AGENTS.length} total · {onlineCount} online</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-emerald-600 shadow-card sm:inline-flex dark:border-slate-700 dark:bg-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />Live</span>
            <ThemeToggle />
            <button type="button" onClick={onInviteAgent} className="min-h-10 rounded-xl bg-primary px-3 text-sm font-bold text-white shadow-card transition hover:bg-primary-hover sm:px-5">+ <span className="hidden sm:inline">Invite Agent</span><span className="sm:hidden">Invite</span></button>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1 sm:max-w-sm">
            <span className="sr-only">Search agents</span>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agents..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-card outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as 'all' | DirectoryAgentStatus)} className="h-11 min-w-36 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-card outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="all">All Statuses</option><option value="available">Available</option><option value="busy">Busy</option><option value="approaching">Approaching</option><option value="offline">Offline</option>
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </label>
          <label className="relative">
            <span className="sr-only">Filter by region</span>
            <select value={region} onChange={(event) => setRegion(event.target.value)} className="h-11 min-w-36 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-9 text-sm font-semibold text-slate-700 shadow-card outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="all">All Regions</option>{regions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-[minmax(0,1.5fr)_110px] gap-4 border-b bg-slate-50/70 px-4 py-3 text-xs font-semibold text-slate-500 sm:grid-cols-[minmax(0,1.4fr)_110px_minmax(120px,1fr)_120px] sm:px-5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <span>Agent</span><span className="hidden sm:block">Agent ID</span><span className="hidden sm:block">Region</span><span>Status</span>
          </div>
          {filteredAgents.length ? (
            <ul>
              {filteredAgents.map((agent) => {
                const selected = detailsOpen && selectedId === agent.id;
                return (
                  <li key={agent.id} className="border-b last:border-0 dark:border-slate-800">
                    <button type="button" onClick={() => selectAgent(agent.id)} className={`grid min-h-[70px] w-full grid-cols-[minmax(0,1.5fr)_110px] items-center gap-4 px-4 text-left transition sm:grid-cols-[minmax(0,1.4fr)_110px_minmax(120px,1fr)_120px] sm:px-5 ${selected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                      <span className="flex min-w-0 items-center gap-3"><Avatar name={agent.name} size="sm" /><span className="truncate text-sm font-bold text-slate-900 dark:text-white">{agent.name}</span></span>
                      <span className="hidden text-sm text-slate-500 sm:block dark:text-slate-400">{agent.id}</span>
                      <span className="hidden truncate text-sm font-medium text-slate-700 sm:block dark:text-slate-300">{agent.region}</span>
                      <span><StatusBadge status={agent.status} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><SearchIcon className="h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-900 dark:text-white">No agents found</p><p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p></div>
          )}
          <footer className="flex items-center justify-between border-t px-4 py-4 text-sm text-slate-500 sm:px-5 dark:border-slate-800 dark:text-slate-400"><span>Showing {filteredAgents.length} of {DIRECTORY_AGENTS.length} agents</span><div className="hidden gap-2 sm:flex"><button type="button" disabled className="rounded-lg border px-3 py-1.5 opacity-50">Previous</button><button type="button" disabled className="rounded-lg border px-3 py-1.5 opacity-50">Next</button></div></footer>
        </div>
      </section>

      {detailsOpen && (
        <>
          <button type="button" aria-label="Close agent details" onClick={() => setDetailsOpen(false)} className="fixed inset-0 z-[890] bg-slate-950/35 xl:hidden" />
          <aside className="fixed inset-y-0 right-0 z-[900] w-[min(440px,100vw)] border-l border-slate-200 shadow-elevation-4 xl:static xl:z-auto xl:w-[440px] xl:shrink-0 xl:shadow-none dark:border-slate-800">
            <AgentDetails agent={selectedAgent} onClose={() => setDetailsOpen(false)} onAssignTask={onAssignTask} onEditAgent={onEditAgent} />
          </aside>
        </>
      )}
    </div>
  );
}
