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
} from './taskStore';
import { fetchRoadRoute, isRoutingConfigured } from './routingService';
import type { RoadRoute, Task } from '../../../../packages/shared-types';

// Road route is additive to the existing Haversine-based tracking: computed
// lazily, throttled, and never allowed to block or fail the location:update
// heartbeat — if no provider is configured or the request fails, callers just
// keep the task's last-known route (or null, falling back to a straight line).
async function resolveRoute(task: Task, lat: number, lng: number): Promise<RoadRoute | null> {
  if (!isRoutingConfigured()) return task.route;

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
              io.emit('location:broadcast', { agent, distance, eta, route });
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

    socket.on('task:complete', async ({ agentId, taskId }: { agentId: string; taskId: string }) => {
      try {
        const agent = await getAgent(agentId);
        const task = await getTask(taskId);
        if (!agent || !task) return;

        const { distance } = computeDistanceAndEta(agent.lat, agent.lng, task);
        const geoVerified = distance <= task.radiusMeters;

        await setTaskGeoVerified(taskId, geoVerified);
        await setTaskStatus(taskId, 'completed');
        await setAgentStatus(agentId, 'available');

        io.emit('task:completed:broadcast', { agentId, taskId, geoVerified });
      } catch (err: any) {
        console.error('[socket] task:complete error:', err.message);
      }
    });
  });
}
