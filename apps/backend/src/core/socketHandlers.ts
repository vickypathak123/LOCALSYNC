import { Server, Socket } from 'socket.io';
import { setAgentLocation, setAgentOnline, setAgentOffline, setAgentStatus, getAgent, getAllAgents } from './agentStore';
import {
  getTask,
  setTaskStatus,
  setTaskGeoVerified,
  computeDistanceAndEta,
  setTaskRoute,
  getRouteRecomputeState,
  shouldRecomputeRoute,
  setTaskEstimatedArrival,
  setTaskDelayReason,
} from './taskStore';
import { fetchRoadRoute } from './routingService';
import { computeTaskDelayStatus, type RoadRoute, type Task } from '../../../../packages/shared-types';

// Road route is additive to the existing Haversine-based tracking: computed
// lazily, throttled, and never allowed to block or fail the location:update
// heartbeat — if both providers fail, callers just keep the task's last-known
// route (or null, falling back to a straight line).
async function resolveRoute(task: Task, lat: number, lng: number): Promise<RoadRoute | null> {
  const recomputeState = await getRouteRecomputeState(task.taskId);
  if (!shouldRecomputeRoute(recomputeState, lat, lng)) return task.route;

  const fresh = await fetchRoadRoute(lat, lng, task.destLat, task.destLng);
  if (!fresh) return task.route;

  await setTaskRoute(task.taskId, fresh, lat, lng);
  return fresh;
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    getAllAgents()
      .then((agents) => socket.emit('agents:sync', agents))
      .catch((err) => console.error('[socket] agents:sync failed:', err.message));

    socket.on('agent:online', async ({ agentId }: { agentId: string }) => {
      try {
        socket.join(agentId);
        await setAgentOnline(agentId);
        const agents = await getAllAgents();
        io.emit('agents:sync', agents);
      } catch (err: any) {
        console.error('[socket] agent:online error:', err.message);
      }
    });

    socket.on('agent:offline', async ({ agentId }: { agentId: string }) => {
      try {
        await setAgentOffline(agentId);
        const agents = await getAllAgents();
        io.emit('agents:sync', agents);
      } catch (err: any) {
        console.error('[socket] agent:offline error:', err.message);
      }
    });

    socket.on(
      'location:update',
      async ({ agentId, lat, lng }: { agentId: string; lat: number; lng: number; timestamp: number }) => {
        try {
          await setAgentLocation(agentId, lat, lng);
          const agent = await getAgent(agentId);
          if (!agent) return;

          if (agent.currentTaskId) {
            const task = await getTask(agent.currentTaskId);
            if (task && task.status === 'in_progress') {
              const { distance, eta } = computeDistanceAndEta(lat, lng, task);
              if (distance <= task.radiusMeters) {
                await setTaskStatus(task.taskId, 'reached');
                io.emit('task:reached:broadcast', { agentId, taskId: task.taskId });
              }
              const route = await resolveRoute(task, lat, lng);

              // Fixed once — the first tick after acceptance where an ETA is
              // known. Anchored on acceptedAt (not "now") per the product
              // requirement that this target never drifts on refresh/re-route.
              let estimatedArrivalAt = task.estimatedArrivalAt;
              if (estimatedArrivalAt === null && task.acceptedAt !== null) {
                estimatedArrivalAt = task.acceptedAt + eta * 1000;
                await setTaskEstimatedArrival(task.taskId, estimatedArrivalAt);
              }

              io.emit('location:broadcast', { agent, distance, eta, route, estimatedArrivalAt });
              return;
            }
          }
          io.emit('location:broadcast', { agent });
        } catch (err: any) {
          console.error('[socket] location:update error:', err.message);
        }
      }
    );

    socket.on('task:accept', async ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      try {
        await setTaskStatus(taskId, 'in_progress');
        await setAgentStatus(agentId, 'busy');
        const agent = await getAgent(agentId);
        io.emit('location:broadcast', { agent });
      } catch (err: any) {
        console.error('[socket] task:accept error:', err.message);
      }
    });

    socket.on('task:reject', async ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      try {
        await setTaskStatus(taskId, 'rejected');
        io.emit('task:rejected:broadcast', { agentId, taskId });
      } catch (err: any) {
        console.error('[socket] task:reject error:', err.message);
      }
    });

    socket.on(
      'task:complete',
      async ({ agentId, taskId, delayReason }: { agentId: string; taskId: string; delayReason?: string }) => {
        try {
          const agent = await getAgent(agentId);
          const task = await getTask(taskId);
          if (!agent || !task) return;

          // Past the grace period, a reason is mandatory before the task can
          // close out — either just submitted, or already on file from an
          // earlier attempt (so retrying with the same reason isn't rejected
          // again). Rejecting here (rather than silently completing anyway) is
          // what makes the requirement actually enforced instead of advisory.
          const delayStatus = computeTaskDelayStatus(task.estimatedArrivalAt);
          const hasReason = !!(delayReason?.trim() || task.delayReason);
          if (delayStatus === 'delayed' && !hasReason) {
            io.to(agentId).emit('task:complete:rejected', {
              taskId,
              reason: 'delay_reason_required',
              message: 'This task is past its grace period — submit a delay reason before marking it complete.',
            });
            return;
          }
          if (delayReason?.trim()) {
            await setTaskDelayReason(taskId, delayReason.trim());
          }

          const { distance } = computeDistanceAndEta(agent.lat, agent.lng, task);
          const geoVerified = distance <= task.radiusMeters;

          await setTaskGeoVerified(taskId, geoVerified);
          await setTaskStatus(taskId, 'completed');
          await setAgentStatus(agentId, 'available');

          io.emit('task:completed:broadcast', {
            agentId,
            taskId,
            geoVerified,
            delayReason: delayReason?.trim() || task.delayReason || null,
          });
        } catch (err: any) {
          console.error('[socket] task:complete error:', err.message);
        }
      }
    );
  });
}
