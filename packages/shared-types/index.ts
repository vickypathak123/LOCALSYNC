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
}
