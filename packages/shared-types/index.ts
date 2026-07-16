export type AgentStatus = 'available' | 'busy';
export type TaskStatus = 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'reached' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
// 'invited'          = owner created the agent by email; system password sent, first login pending.
// 'pending_approval' = agent self-registered via invite code; awaiting owner approval before they can log in.
// 'active'           = fully onboarded (either path) — can log in and be dispatched.
// 'rejected'         = owner declined a pending_approval registration.
export type AccountStatus = 'invited' | 'pending_approval' | 'active' | 'rejected';
export interface Agent {
  agentId: string; orgId: string; name: string; email: string; phone: string; online: boolean;
  status: AgentStatus; accountStatus: AccountStatus;
  // Work-eligibility toggle, independent of accountStatus — an archived agent can still log in,
  // just can't be assigned new tasks (see PRD addendum on Archive/Inactivate).
  isArchived: boolean;
  lat: number; lng: number; currentTaskId: string | null;
  createdAt: number; updatedAt: number;
}
// A real road route from a routing provider (Mapbox Directions). geometry is
// GeoJSON-ordered [lng, lat] pairs, matching what routing APIs return — callers
// must flip to [lat, lng] for Leaflet.
export interface RoadRoute {
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

export interface Task {
  taskId: string; agentId: string; destLat: number; destLng: number; radiusMeters: number;
  description: string; status: TaskStatus; geoVerified: boolean | null; createdAt: number;
  priority: TaskPriority;
  // Status-transition timestamps — stamped server-side the moment each transition happens
  // (see taskStore.setTaskStatus), so a page refresh can rebuild the exact same timeline
  // instead of only knowing "createdAt" and guessing at the rest.
  acceptedAt: number | null;
  reachedAt: number | null;
  completedAt: number | null;
  rejectedAt: number | null;
  // Null until the first road route is computed (lazily, once the task is
  // in_progress), or if no routing provider is configured — callers must fall
  // back to the Haversine distance/eta in that case.
  route: RoadRoute | null;
  // A fixed target, computed exactly once (acceptedAt + the first known ETA)
  // the moment the agent starts moving — never recalculated as distance/eta
  // change, so it doesn't drift every time the page reloads or the route gets
  // re-fetched. Null until the agent has accepted and at least one location
  // tick has landed.
  estimatedArrivalAt: number | null;
  // Required from the agent once a task passes the grace period past
  // estimatedArrivalAt before it can be marked complete (see
  // computeTaskDelayStatus / task:complete's enforcement in socketHandlers.ts).
  delayReason: string | null;
}

export const DELAY_GRACE_PERIOD_MINUTES = 15;

export type TaskDelayStatus = 'on_time' | 'grace_period' | 'delayed';

// Pure and shared so the backend (enforcement) and frontend (display) can
// never disagree about when a task is "delayed" — both import this instead of
// each re-deriving their own copy of the grace-period math.
export function computeTaskDelayStatus(
  estimatedArrivalAt: number | null,
  now: number = Date.now()
): TaskDelayStatus | null {
  if (!estimatedArrivalAt) return null;
  const graceEndsAt = estimatedArrivalAt + DELAY_GRACE_PERIOD_MINUTES * 60 * 1000;
  if (now <= estimatedArrivalAt) return 'on_time';
  if (now <= graceEndsAt) return 'grace_period';
  return 'delayed';
}
