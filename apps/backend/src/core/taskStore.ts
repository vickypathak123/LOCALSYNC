import redisClient from '../redisClient';
import { Task, TaskStatus, TaskPriority, RoadRoute } from '../../../../packages/shared-types';

const ASSUMED_SPEED_MPS = 8;

// Route recompute throttle: a location:update tick arrives every ~3s (see
// socketHandlers.ts), but a road route only needs refreshing roughly as often
// as the agent could plausibly have drifted off the previously computed path.
// Gating on both time AND distance means steady progress along the same route
// doesn't burn a Directions API call every tick.
export const ROUTE_RECOMPUTE_INTERVAL_MS = 20_000;
export const ROUTE_RECOMPUTE_DISTANCE_M = 80;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createTask(
  taskId: string,
  orgId: string,
  agentId: string,
  destLat: number,
  destLng: number,
  radiusMeters: number,
  description: string,
  priority: TaskPriority = 'medium'
): Promise<void> {
  await redisClient.hSet(`task:${taskId}`, {
    orgId,
    agentId,
    destLat: destLat.toString(),
    destLng: destLng.toString(),
    radiusMeters: radiusMeters.toString(),
    description,
    status: 'pending',
    geoVerified: '',
    createdAt: Date.now().toString(),
    priority,
    acceptedAt: '',
    reachedAt: '',
    completedAt: '',
    rejectedAt: '',
    routeGeometry: '',
    routeDistanceMeters: '',
    routeDurationSeconds: '',
    routeComputedAt: '',
    routeComputedFromLat: '',
    routeComputedFromLng: '',
  });
  await redisClient.hSet(`agent:${agentId}`, { currentTaskId: taskId });
}

function parseTask(taskId: string, raw: Record<string, string>): Task {
  return {
    taskId,
    agentId: raw.agentId,
    destLat: parseFloat(raw.destLat) || 0,
    destLng: parseFloat(raw.destLng) || 0,
    radiusMeters: parseFloat(raw.radiusMeters) || 0,
    description: raw.description || '',
    status: (raw.status as TaskStatus) || 'pending',
    geoVerified: raw.geoVerified === '' ? null : raw.geoVerified === 'true',
    createdAt: parseInt(raw.createdAt, 10) || 0,
    priority: (raw.priority as TaskPriority) || 'medium',
    acceptedAt: raw.acceptedAt ? parseInt(raw.acceptedAt, 10) : null,
    reachedAt: raw.reachedAt ? parseInt(raw.reachedAt, 10) : null,
    completedAt: raw.completedAt ? parseInt(raw.completedAt, 10) : null,
    rejectedAt: raw.rejectedAt ? parseInt(raw.rejectedAt, 10) : null,
    route: raw.routeGeometry
      ? {
          geometry: JSON.parse(raw.routeGeometry),
          distanceMeters: parseFloat(raw.routeDistanceMeters) || 0,
          durationSeconds: parseFloat(raw.routeDurationSeconds) || 0,
        }
      : null,
  };
}

export async function getTask(taskId: string): Promise<Task | null> {
  const raw = await redisClient.hGetAll(`task:${taskId}`);
  if (!raw || Object.keys(raw).length === 0) return null;
  return parseTask(taskId, raw);
}

// Every status transition is timeline-significant, so stamping the matching
// timestamp here (instead of at each call site) guarantees it can never be
// forgotten on a new transition and keeps a single source of truth for "when
// did this task reach status X" that survives a frontend refresh.
const STATUS_TIMESTAMP_FIELD: Partial<Record<TaskStatus, string>> = {
  in_progress: 'acceptedAt',
  reached: 'reachedAt',
  completed: 'completedAt',
  rejected: 'rejectedAt',
};

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const fields: Record<string, string> = { status };
  const timestampField = STATUS_TIMESTAMP_FIELD[status];
  if (timestampField) fields[timestampField] = Date.now().toString();
  await redisClient.hSet(`task:${taskId}`, fields);
}

export async function setTaskGeoVerified(taskId: string, verified: boolean): Promise<void> {
  await redisClient.hSet(`task:${taskId}`, { geoVerified: verified.toString() });
}

export async function setTaskRoute(
  taskId: string,
  route: RoadRoute,
  computedFromLat: number,
  computedFromLng: number
): Promise<void> {
  await redisClient.hSet(`task:${taskId}`, {
    routeGeometry: JSON.stringify(route.geometry),
    routeDistanceMeters: route.distanceMeters.toString(),
    routeDurationSeconds: route.durationSeconds.toString(),
    routeComputedAt: Date.now().toString(),
    routeComputedFromLat: computedFromLat.toString(),
    routeComputedFromLng: computedFromLng.toString(),
  });
}

// Internal-only fields (not part of the public Task shape) that back the
// recompute throttle — read directly off the raw hash rather than parseTask.
export async function getRouteRecomputeState(
  taskId: string
): Promise<{ computedAt: number; fromLat: number; fromLng: number } | null> {
  const raw = await redisClient.hGetAll(`task:${taskId}`);
  if (!raw.routeComputedAt) return null;
  return {
    computedAt: parseInt(raw.routeComputedAt, 10) || 0,
    fromLat: parseFloat(raw.routeComputedFromLat) || 0,
    fromLng: parseFloat(raw.routeComputedFromLng) || 0,
  };
}

export function shouldRecomputeRoute(
  recomputeState: { computedAt: number; fromLat: number; fromLng: number } | null,
  currentLat: number,
  currentLng: number
): boolean {
  if (!recomputeState) return true;
  const elapsed = Date.now() - recomputeState.computedAt;
  if (elapsed < ROUTE_RECOMPUTE_INTERVAL_MS) return false;
  const drifted = haversineMeters(currentLat, currentLng, recomputeState.fromLat, recomputeState.fromLng);
  return drifted >= ROUTE_RECOMPUTE_DISTANCE_M;
}

export function computeDistanceAndEta(
  agentLat: number,
  agentLng: number,
  task: Task
): { distance: number; eta: number } {
  const distance = haversineMeters(agentLat, agentLng, task.destLat, task.destLng);
  const eta = distance / ASSUMED_SPEED_MPS;
  return { distance, eta };
}

// Full task history for an org — every task hash lives forever in Redis (never
// deleted), so this doubles as both "restore active tasks after a refresh" and
// "task history" with zero extra storage. orgId is stamped on the hash at
// creation specifically so this can filter directly instead of joining through
// each task's agent.
export async function listTasksByOrg(orgId: string): Promise<Task[]> {
  const tasks: Task[] = [];
  for await (const key of redisClient.scanIterator({ MATCH: 'task:*' })) {
    const raw = await redisClient.hGetAll(key);
    if (raw && raw.orgId === orgId) {
      tasks.push(parseTask(key.replace('task:', ''), raw));
    }
  }
  return tasks.sort((a, b) => b.createdAt - a.createdAt);
}
