import type { Agent } from './types';
import type { TaskUI } from './types';

// How close (as a multiple of the geofence radius) an agent must be to a task's
// destination before we consider them "approaching" rather than just "in transit".
// Purely a client-side presentation threshold — derived from real distance/radius
// telemetry already on the wire, not a new field the backend tracks.
export const APPROACH_RADIUS_MULTIPLIER = 3;

export type DerivedAgentStatus = 'offline' | 'available' | 'busy' | 'in_transit' | 'approaching' | 'on_site';

export interface AgentStatusInfo {
  key: DerivedAgentStatus;
  label: string;
  dotClass: string;
  textClass: string;
  bgClass: string;
  ringClass: string;
}

const STATUS_INFO: Record<DerivedAgentStatus, Omit<AgentStatusInfo, 'key'>> = {
  offline: {
    label: 'Offline',
    dotClass: 'bg-status-offline',
    textClass: 'text-status-offline',
    bgClass: 'bg-status-offline/10',
    ringClass: 'ring-status-offline',
  },
  available: {
    label: 'Available',
    dotClass: 'bg-status-available',
    textClass: 'text-status-available',
    bgClass: 'bg-status-available/10',
    ringClass: 'ring-status-available',
  },
  busy: {
    label: 'Busy',
    dotClass: 'bg-status-busy',
    textClass: 'text-status-busy',
    bgClass: 'bg-status-busy/10',
    ringClass: 'ring-status-busy',
  },
  in_transit: {
    label: 'In Transit',
    dotClass: 'bg-primary',
    textClass: 'text-primary',
    bgClass: 'bg-primary/10',
    ringClass: 'ring-primary',
  },
  approaching: {
    label: 'Approaching',
    dotClass: 'bg-status-busy',
    textClass: 'text-status-busy',
    bgClass: 'bg-status-busy/10',
    ringClass: 'ring-status-busy',
  },
  on_site: {
    label: 'On Site',
    dotClass: 'bg-status-reached',
    textClass: 'text-status-reached',
    bgClass: 'bg-status-reached/10',
    ringClass: 'ring-status-reached',
  },
};

export function deriveAgentStatus(agent: Agent, task?: TaskUI): AgentStatusInfo {
  const key = deriveAgentStatusKey(agent, task);
  return { key, ...STATUS_INFO[key] };
}

function deriveAgentStatusKey(agent: Agent, task?: TaskUI): DerivedAgentStatus {
  if (!agent.online) return 'offline';

  if (task) {
    if (task.status === 'reached') return 'on_site';
    if (task.status === 'in_progress') {
      if (task.distance !== undefined && task.distance <= task.radiusMeters * APPROACH_RADIUS_MULTIPLIER) {
        return 'approaching';
      }
      return 'in_transit';
    }
    if (task.status === 'pending' || task.status === 'accepted') return 'busy';
  }

  return agent.status === 'busy' ? 'busy' : 'available';
}
