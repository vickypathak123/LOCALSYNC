'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getSocket, disconnectSocket } from '@/lib/socket';
import {
  dispatchTask,
  inviteAgent,
  resendAgentInvite,
  approveAgent,
  rejectAgent,
  updateAgent,
  archiveAgent,
  restoreAgent,
  deleteAgent,
  getOrgMe,
  getOrgTasks,
  type OrgInfo,
  type UpdateAgentPayload,
} from '@/lib/api';
import { getSession, clearSession, type Session } from '@/lib/auth';
import type { Agent, TaskUI, TaskStatus } from '@/lib/types';
import type { ActivityEvent } from '@/lib/activity';
import { APPROACH_RADIUS_MULTIPLIER } from '@/lib/agentStatus';
import { isToday } from '@/lib/format';
import CommandHeader from '@/components/CommandHeader';
import AgentRosterList from '@/components/AgentRosterList';
import TaskRosterList from '@/components/TaskRosterList';
import ActivityFeed from '@/components/ActivityFeed';
import AgentDetailsPanel from '@/components/AgentDetailsPanel';
import DispatchModal from '@/components/DispatchModal';
import InviteAgentModal from '@/components/InviteAgentModal';
import EditAgentModal from '@/components/EditAgentModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import OrgPanel from '@/components/OrgPanel';
import ToastStack, { type ToastMessage } from '@/components/Toast';
import { UsersIcon, TaskIcon } from '@/components/icons';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

const NON_TERMINAL: TaskStatus[] = ['pending', 'accepted', 'in_progress', 'reached'];

type LeftTab = 'agents' | 'tasks';

export default function DashboardPage() {
  const router = useRouter();
  const [session, setLocalSession] = useState<Session | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasksById, setTasksById] = useState<Record<string, TaskUI>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchAgentId, setDispatchAgentId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [editAgentTarget, setEditAgentTarget] = useState<Agent | null>(null);
  const [deleteAgentTarget, setDeleteAgentTarget] = useState<Agent | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState<ToastMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const prevOnlineRef = useRef<Record<string, boolean>>({});
  const hasSyncedOnceRef = useRef(false);
  const acceptedTaskIdsRef = useRef<Set<string>>(new Set());
  const approachingTaskIdsRef = useRef<Set<string>>(new Set());
  const reachedTaskIdsRef = useRef<Set<string>>(new Set());
  // Socket handlers are registered once per session and must read the latest
  // agent roster without re-subscribing on every agents:sync — a ref sidesteps
  // the stale-closure trap that plain `agents` state would hit here.
  const agentsRef = useRef<Agent[]>([]);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const pushToast = useCallback((title: string, body: string) => {
    const message = { id: crypto.randomUUID(), title, body };
    setToasts((prev) => [...prev, message]);
    setNotifications((prev) => [...prev, message]);
    setUnreadCount((prev) => prev + 1);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushEvent = useCallback(
    (title: string, agentName: string, detail: string, dotClass: string) => {
      setEvents((prev) => [
        { id: crypto.randomUUID(), title, agentName, detail, timestamp: Date.now(), dotClass },
        ...prev,
      ].slice(0, 100));
    },
    []
  );

  useEffect(() => {
    const s = getSession();
    if (!s?.token) {
      router.replace('/login');
      return;
    }
    if (!s.orgId) {
      router.replace('/org');
      return;
    }
    setLocalSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    getOrgMe(session.token).then(setOrgInfo).catch(() => {
      // A token minted before the org existed (or an expired one) has no valid
      // orgId claim server-side, even though the local session object still has
      // orgId cached. Rather than leave the UI stuck on "Loading…" forever,
      // force a clean re-login so a fresh, correct token gets minted.
      clearSession();
      router.replace('/login');
    });
  }, [session, router]);

  // Rehydrate every task this org has ever dispatched on load (task hashes never
  // expire in Redis) — this is what makes a refresh restore in-flight
  // destinations/routes/status instead of the dashboard only knowing about
  // whatever socket events happened to arrive after the tab reopened.
  useEffect(() => {
    if (!session) return;
    getOrgTasks(session.token)
      .then((tasks) => {
        setTasksById((prev) => {
          const seeded: Record<string, TaskUI> = {};
          for (const task of tasks) seeded[task.taskId] = task;
          // Anything already patched by a socket event that beat this fetch wins —
          // it's strictly fresher than the REST snapshot.
          return { ...seeded, ...prev };
        });
        // Use the real server-stamped timestamps (not a guess from status) to mark
        // which milestones already happened, so the feed doesn't re-announce them —
        // "Approaching Zone" is deliberately left unseeded: it's a session-local
        // derived signal with no backend timestamp, and suppressing it here would
        // hide a legitimately fresh signal right after a reload.
        for (const task of tasks) {
          if (task.acceptedAt) acceptedTaskIdsRef.current.add(task.taskId);
          if (task.reachedAt) reachedTaskIdsRef.current.add(task.taskId);
        }
      })
      .catch((err) => console.error('[dashboard] failed to load org tasks:', err));
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const socket = getSocket();

    socket.on('agents:sync', (allAgents: Agent[]) => {
      const scoped = allAgents.filter((a) => a.orgId === session.orgId);

      if (hasSyncedOnceRef.current) {
        for (const agent of scoped) {
          const wasOnline = prevOnlineRef.current[agent.agentId];
          if (wasOnline === false && agent.online) {
            pushEvent('Came Online', agent.name, 'GPS ready', 'bg-status-busy');
          } else if (wasOnline === true && !agent.online) {
            pushEvent('Went Offline', agent.name, 'Last sync just now', 'bg-status-offline');
          }
        }
      }
      prevOnlineRef.current = Object.fromEntries(scoped.map((a) => [a.agentId, a.online]));
      hasSyncedOnceRef.current = true;

      setAgents(scoped);
    });

    socket.on('location:broadcast', ({ agent, distance, eta, route }: { agent: Agent; distance?: number; eta?: number; route?: import('@/lib/types').RoadRoute | null }) => {
      if (agent.orgId !== session.orgId) return;
      setAgents((prev) => {
        const idx = prev.findIndex((a) => a.agentId === agent.agentId);
        if (idx === -1) return [...prev, agent];
        const next = [...prev];
        next[idx] = agent;
        return next;
      });

      if (agent.currentTaskId && distance !== undefined) {
        const taskId = agent.currentTaskId;
        setTasksById((prev) => {
          const existing = prev[taskId];
          // A location:broadcast only ever carries distance/eta deltas, never the
          // full task shape (destLat/destLng/radiusMeters/etc) — if this tab doesn't
          // already have the base record (e.g. it arrived before the org/tasks
          // rehydration fetch finished, or raced a stale reconnect), there's nothing
          // safe to merge into. Drop the tick rather than writing a task missing
          // required fields — that's what fed undefined coordinates into Leaflet.
          if (!existing) return prev;

          const isTerminal = !NON_TERMINAL.includes(existing.status);
          const wasPending = existing.status === 'pending' || existing.status === 'accepted';

          if (wasPending && !acceptedTaskIdsRef.current.has(taskId)) {
            acceptedTaskIdsRef.current.add(taskId);
            pushEvent('Task Accepted', agent.name, `${existing.description || 'Task'}`, 'bg-primary');
          }
          if (
            existing.radiusMeters > 0 &&
            distance <= existing.radiusMeters * APPROACH_RADIUS_MULTIPLIER &&
            !approachingTaskIdsRef.current.has(taskId)
          ) {
            approachingTaskIdsRef.current.add(taskId);
            pushEvent('Approaching Zone', agent.name, `${Math.round(distance)}m away`, 'bg-status-busy');
          }

          return {
            ...prev,
            [taskId]: {
              ...existing,
              status: isTerminal ? existing.status : 'in_progress',
              // The socket payload doesn't carry the server timestamp, so stamp it
              // client-side the moment the transition is observed (network latency
              // aside, this is the same instant the backend recorded) — otherwise the
              // timeline would sit blank live and only backfill after a refresh.
              acceptedAt: existing.acceptedAt ?? (wasPending ? Date.now() : null),
              distance,
              eta,
              // route is only ever a fresher-or-equal value from the backend
              // (undefined when routing isn't configured at all) — never clobber
              // an already-known route with nothing.
              route: route !== undefined ? route : existing.route,
            },
          };
        });
      }
    });

    socket.on('task:reached:broadcast', ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      setTasksById((prev) => {
        if (!prev[taskId]) return prev;
        if (!reachedTaskIdsRef.current.has(taskId)) {
          reachedTaskIdsRef.current.add(taskId);
          const agentName = agentsRef.current.find((a) => a.agentId === agentId)?.name || 'Agent';
          pushEvent('Geofence Entered', agentName, `${prev[taskId].description || 'Destination'} · within radius`, 'bg-status-reached');
        }
        return { ...prev, [taskId]: { ...prev[taskId], status: 'reached', reachedAt: prev[taskId].reachedAt ?? Date.now() } };
      });
    });

    socket.on('task:rejected:broadcast', ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      setTasksById((prev) => {
        if (!prev[taskId]) return prev;
        const agentName = agentsRef.current.find((a) => a.agentId === agentId)?.name || 'Agent';
        pushEvent('Task Rejected', agentName, prev[taskId].description || 'Task', 'bg-status-rejected');
        return { ...prev, [taskId]: { ...prev[taskId], status: 'rejected', rejectedAt: prev[taskId].rejectedAt ?? Date.now() } };
      });
    });

    socket.on(
      'task:completed:broadcast',
      ({ agentId, taskId, geoVerified }: { agentId: string; taskId: string; geoVerified: boolean }) => {
        setTasksById((prev) =>
          prev[taskId]
            ? {
                ...prev,
                [taskId]: {
                  ...prev[taskId],
                  status: 'completed',
                  geoVerified,
                  completedAt: prev[taskId].completedAt ?? Date.now(),
                },
              }
            : prev
        );
        // The backend's task:complete handler always flips the agent back to 'available',
        // but doesn't re-broadcast the agent record — patch it locally instead of waiting
        // up to one location:update tick (~3s) for the next agents:sync/location:broadcast.
        setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, status: 'available' } : a)));
        const agentName = agentsRef.current.find((a) => a.agentId === agentId)?.name || 'Agent';
        pushEvent(
          'Task Completed',
          agentName,
          geoVerified ? 'Geo Verified' : 'Not Geo Verified',
          geoVerified ? 'bg-status-verified' : 'bg-status-unverified'
        );
      }
    );

    socket.on(
      'agent:activated',
      ({ agentId, name, email, orgId }: { agentId: string; name: string; email: string; orgId: string }) => {
        if (orgId !== session.orgId) return;
        setAgents((prev) =>
          prev.map((a) => (a.agentId === agentId ? { ...a, accountStatus: 'active' } : a))
        );
        pushToast('Agent activated', `${name} (${email}) set their password and is ready to work.`);
        pushEvent('Agent Activated', name, 'Password set · ready to work', 'bg-status-verified');
      }
    );

    socket.on('agent:approved', ({ agentId, name, orgId }: { agentId: string; name: string; orgId: string }) => {
      if (orgId !== session.orgId) return;
      setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, accountStatus: 'active' } : a)));
      pushToast('Agent approved', `${name} was approved and can now log in.`);
      pushEvent('Agent Approved', name, 'Can now log in', 'bg-status-verified');
    });

    return () => {
      socket.off('agents:sync');
      socket.off('location:broadcast');
      socket.off('task:reached:broadcast');
      socket.off('task:rejected:broadcast');
      socket.off('task:completed:broadcast');
      socket.off('agent:activated');
      socket.off('agent:approved');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, pushToast, pushEvent]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const dispatchPreselectedAgent = useMemo(
    () => agents.find((a) => a.agentId === dispatchAgentId) ?? null,
    [agents, dispatchAgentId]
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agentId === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );
  const selectedTask = useMemo(
    () => (selectedAgent?.currentTaskId ? tasksById[selectedAgent.currentTaskId] : undefined),
    [selectedAgent, tasksById]
  );

  const pendingApprovalAgents = useMemo(() => agents.filter((a) => a.accountStatus === 'pending_approval'), [agents]);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [agents, searchQuery]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const all = Object.values(tasksById);
    if (!q) return all;
    return all.filter((t) => {
      const agentName = agents.find((a) => a.agentId === t.agentId)?.name || '';
      return agentName.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    });
  }, [tasksById, agents, searchQuery]);

  const handlePickLocation = useCallback((lat: number, lng: number) => {
    setPickedLocation({ lat, lng });
    setPickMode(false);
  }, []);

  function openDispatchFor(agentId: string) {
    setDispatchAgentId(agentId);
    setDispatchOpen(true);
  }

  function openNewTask() {
    setDispatchAgentId(null);
    setDispatchOpen(true);
  }

  function closeDispatch() {
    setDispatchOpen(false);
    setDispatchAgentId(null);
    setPickMode(false);
    setPickedLocation(null);
  }

  async function handleDispatchSubmit(payload: {
    agentId: string;
    destLat: number;
    destLng: number;
    radiusMeters: number;
    description: string;
    priority: import('@/lib/types').TaskPriority;
  }) {
    if (!session) return;

    const res = await dispatchTask(payload, session.token);

    setTasksById((prev) => ({
      ...prev,
      [res.taskId]: {
        taskId: res.taskId,
        agentId: payload.agentId,
        destLat: payload.destLat,
        destLng: payload.destLng,
        radiusMeters: payload.radiusMeters,
        description: payload.description,
        priority: payload.priority,
        status: 'pending',
        geoVerified: null,
        createdAt: Date.now(),
        acceptedAt: null,
        reachedAt: null,
        completedAt: null,
        rejectedAt: null,
        route: null,
      },
    }));

    const agentName = agents.find((a) => a.agentId === payload.agentId)?.name || 'Agent';
    pushEvent('Task Assigned', agentName, payload.description || 'New task', 'bg-primary');

    closeDispatch();
  }

  async function handleInviteSubmit(payload: { email: string; name: string }) {
    if (!session) return;
    await inviteAgent(payload.email, payload.name, session.token);
    setInviteModalOpen(false);
    pushToast('Invite sent', `${payload.name} was emailed a temporary password.`);
  }

  async function handleResendInvite(agentId: string) {
    if (!session) return;
    await resendAgentInvite(agentId, session.token);
    pushToast('Invite resent', 'A new temporary password was emailed.');
  }

  async function handleApprove(agentId: string) {
    if (!session) return;
    await approveAgent(agentId, session.token);
    setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, accountStatus: 'active' } : a)));
  }

  async function handleReject(agentId: string) {
    if (!session) return;
    await rejectAgent(agentId, session.token);
    setAgents((prev) => prev.map((a) => (a.agentId === agentId ? { ...a, accountStatus: 'rejected' } : a)));
  }

  async function handleUpdateAgent(payload: UpdateAgentPayload) {
    if (!session || !editAgentTarget) return;
    const updated = await updateAgent(editAgentTarget.agentId, payload, session.token);
    setAgents((prev) => prev.map((a) => (a.agentId === updated.agentId ? updated : a)));
    setEditAgentTarget(null);
    pushToast('Agent updated', `${updated.name}'s details were saved.`);
  }

  async function handleToggleArchive(agent: Agent) {
    if (!session) return;
    if (agent.isArchived) {
      await restoreAgent(agent.agentId, session.token);
      setAgents((prev) => prev.map((a) => (a.agentId === agent.agentId ? { ...a, isArchived: false } : a)));
      pushToast('Agent restored', `${agent.name} can be assigned tasks again.`);
    } else {
      await archiveAgent(agent.agentId, session.token);
      setAgents((prev) => prev.map((a) => (a.agentId === agent.agentId ? { ...a, isArchived: true } : a)));
      pushToast('Agent archived', `${agent.name} is now inactive and won't receive new tasks.`);
    }
  }

  async function handleConfirmDelete() {
    if (!session || !deleteAgentTarget) return;
    await deleteAgent(deleteAgentTarget.agentId, session.token);
    setAgents((prev) => prev.filter((a) => a.agentId !== deleteAgentTarget.agentId));
    if (selectedAgentId === deleteAgentTarget.agentId) setSelectedAgentId(null);
    pushToast('Agent deleted', `${deleteAgentTarget.name} was permanently removed from the organization.`);
    setDeleteAgentTarget(null);
  }

  function handleViewHistory(agent: Agent) {
    setLeftTab('tasks');
    setSearchQuery(agent.name);
  }

  function handleLogout() {
    disconnectSocket();
    clearSession();
    router.replace('/login');
  }

  if (!session) return null;

  const onlineCount = agents.filter((a) => a.online).length;
  const activeCount = agents.filter((a) => a.online && a.currentTaskId).length;
  const todayCount = Object.values(tasksById).filter((t) => isToday(t.createdAt)).length;

  return (
    <main className="flex h-dvh flex-col bg-background dark:bg-slate-950">
      <CommandHeader
        orgName={orgInfo?.name}
        orgCode={orgInfo?.inviteCode}
        ownerName={session.ownerName}
        onlineCount={onlineCount}
        activeCount={activeCount}
        todayCount={todayCount}
        notifications={notifications}
        unreadCount={unreadCount}
        onOpenNotifications={() => setUnreadCount(0)}
        onOpenOrg={() => setOrgModalOpen(true)}
        onOpenInvite={() => setInviteModalOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-1 border-b border-border p-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setLeftTab('agents');
                setSearchQuery('');
              }}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                leftTab === 'agents'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted dark:hover:bg-slate-800'
              }`}
            >
              <UsersIcon className="h-4 w-4" />
              Agents
            </button>
            <button
              type="button"
              onClick={() => {
                setLeftTab('tasks');
                setSearchQuery('');
              }}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                leftTab === 'tasks'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted dark:hover:bg-slate-800'
              }`}
            >
              <TaskIcon className="h-4 w-4" />
              Tasks
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {leftTab === 'agents' ? (
              <AgentRosterList
                agents={filteredAgents}
                pendingApprovalAgents={pendingApprovalAgents}
                tasksById={tasksById}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onApprove={handleApprove}
                onReject={handleReject}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            ) : (
              <TaskRosterList
                tasks={filteredTasks}
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectAgent={setSelectedAgentId}
                onNewTask={openNewTask}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
          </div>
        </aside>

        <div className="relative flex-1">
          <MapView
            agents={agents}
            tasksById={tasksById}
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgentId}
            pickMode={pickMode}
            pickedLocation={pickedLocation}
            onPickLocation={handlePickLocation}
          />
          <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-full border border-border bg-white/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-elevation-2 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-status-available" />
            Live · {onlineCount} online
          </div>
        </div>

        <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-white dark:border-slate-800 dark:bg-slate-900">
          {selectedAgent ? (
            <AgentDetailsPanel
              agent={selectedAgent}
              task={selectedTask}
              onClose={() => setSelectedAgentId(null)}
              onAssignTask={() => openDispatchFor(selectedAgent.agentId)}
              onViewHistory={() => handleViewHistory(selectedAgent)}
              onEdit={() => setEditAgentTarget(selectedAgent)}
              onResendInvite={() => handleResendInvite(selectedAgent.agentId)}
              onToggleArchive={() => handleToggleArchive(selectedAgent)}
              onDelete={() => setDeleteAgentTarget(selectedAgent)}
            />
          ) : (
            <ActivityFeed events={events} />
          )}
        </aside>
      </div>

      {dispatchOpen && (
        <DispatchModal
          agent={dispatchPreselectedAgent}
          agents={agents}
          pickedLocation={pickedLocation}
          pickMode={pickMode}
          onTogglePickMode={() => setPickMode((v) => !v)}
          onClose={closeDispatch}
          onSubmit={handleDispatchSubmit}
        />
      )}

      {inviteModalOpen && (
        <InviteAgentModal onClose={() => setInviteModalOpen(false)} onSubmit={handleInviteSubmit} />
      )}

      {orgModalOpen && <OrgPanel org={orgInfo} agents={agents} onClose={() => setOrgModalOpen(false)} />}

      {editAgentTarget && (
        <EditAgentModal
          agent={editAgentTarget}
          onClose={() => setEditAgentTarget(null)}
          onSubmit={handleUpdateAgent}
        />
      )}

      {deleteAgentTarget && (
        <ConfirmDialog
          title="Delete agent"
          body={`Permanently remove ${deleteAgentTarget.name} from the organization? They will no longer be able to log in, and would need to register or be invited again to rejoin. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteAgentTarget(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
