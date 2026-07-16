import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import { connectRedis } from './redisClient';
import { createAuthRoutes } from './auth/authRoutes';
import { authMiddleware, AuthedRequest } from './auth/authMiddleware';
import { getAgentById } from './auth/orgStore';
import { registerSocketHandlers } from './core/socketHandlers';
import { createTask, listTasksByOrg, getTask, updateTaskDetails, deleteTask } from './core/taskStore';
import { suggestPlaces, retrievePlace } from './core/geocodingService';
import type { Task } from '../../../packages/shared-types';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use('/api', createAuthRoutes(io));

app.post('/api/dispatch', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    if (req.user?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can dispatch tasks' });
    }

    const { agentId, taskId, destLat, destLng, radiusMeters, description, priority } = req.body;
    if (!agentId || !destLat || !destLng || !radiusMeters) {
      return res.status(400).json({ error: 'agentId, destLat, destLng, and radiusMeters are required' });
    }
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
    const finalPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    const agent = await getAgentById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.isArchived === 'true') {
      return res.status(400).json({ error: 'Cannot assign tasks to an archived agent' });
    }

    const finalTaskId = taskId || crypto.randomUUID();
    await createTask(finalTaskId, agent.orgId, agentId, destLat, destLng, radiusMeters, description || '', finalPriority);

    io.to(agentId).emit('task:dispatch', {
      taskId: finalTaskId,
      destLat,
      destLng,
      radiusMeters,
      description: description || '',
      priority: finalPriority,
    });

    res.json({ ok: true, taskId: finalTaskId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Dispatch failed' });
  }
});

// Address/place-name search for the dispatch modal's destination picker —
// proxied server-side (same reason routing is proxied) so the Mapbox token
// never reaches the browser bundle. Requires only authentication, not the
// owner role, since either an owner or an agent-side tool could plausibly
// want this later. Two-step Search Box API flow: `suggest` returns
// lightweight rows as the user types, `retrieve` resolves one chosen
// suggestion to real coordinates — see geocodingService.ts.
app.get('/api/geocode/suggest', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 3) {
      return res.json([]);
    }
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : crypto.randomUUID();

    // Optional proximity bias — nearest-first ranking from wherever the
    // dispatcher is (or the map's current focal point), see geocodingService.
    let proximity: { lat: number; lng: number } | undefined;
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      proximity = { lat, lng };
    }

    const results = await suggestPlaces(q, sessionToken, proximity);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Geocode suggest failed' });
  }
});

app.get('/api/geocode/retrieve', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    const sessionToken = typeof req.query.sessionToken === 'string' ? req.query.sessionToken : '';
    if (!id || !sessionToken) {
      return res.status(400).json({ error: 'id and sessionToken are required' });
    }

    const result = await retrievePlace(id, sessionToken);
    if (!result) {
      return res.status(404).json({ error: 'Place not found' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Geocode retrieve failed' });
  }
});

// Rehydration endpoint: every task hash lives permanently in Redis, so this
// doubles as "restore active tasks after a dashboard refresh" (Track B fix for
// the frontend losing its in-memory taskId map on reload) and "task history"
// (nothing extra to store — it's the same data).
app.get('/api/org/tasks', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    if (req.user?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can list org tasks' });
    }
    if (!req.user.orgId) {
      return res.json([]);
    }

    const tasks = await listTasksByOrg(req.user.orgId);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list tasks' });
  }
});

const TERMINAL_TASK_STATUSES = ['completed', 'rejected'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Both routes below share the same ownership check: a task has no orgId on
// its own public shape (deliberately — see taskStore.ts), so ownership is
// verified transitively through its assigned agent, same as every other
// agent-scoped route in this file.
type OwnedTaskResult = { ok: true; task: Task } | { ok: false; status: number; message: string };

async function loadOwnedNonTerminalTask(taskId: string, ownerOrgId: string | undefined): Promise<OwnedTaskResult> {
  const task = await getTask(taskId);
  if (!task) return { ok: false, status: 404, message: 'Task not found' };
  const agent = await getAgentById(task.agentId);
  if (!agent || agent.orgId !== ownerOrgId) return { ok: false, status: 404, message: 'Task not found' };
  if (TERMINAL_TASK_STATUSES.includes(task.status)) {
    return { ok: false, status: 400, message: `Cannot modify a ${task.status} task` };
  }
  return { ok: true, task };
}

app.post('/api/task/update', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    if (req.user?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can update tasks' });
    }
    const { taskId, description, priority, radiusMeters, destLat, destLng } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }
    if (priority !== undefined && !VALID_TASK_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const result = await loadOwnedNonTerminalTask(taskId, req.user.orgId);
    if (!result.ok) return res.status(result.status).json({ error: result.message });
    const { task } = result;

    await updateTaskDetails(taskId, { description, priority, radiusMeters, destLat, destLng });
    const updated = await getTask(taskId);

    io.emit('task:updated:broadcast', updated);
    // Best-effort: let a listening Android client refresh its own copy of the
    // task (new destination/radius/description) if it chooses to handle this
    // — see API_CONTRACT.md addendum. Not required for the dashboard, which
    // already has `updated` from the broadcast above.
    io.to(task.agentId).emit('task:dispatch', {
      taskId,
      destLat: updated!.destLat,
      destLng: updated!.destLng,
      radiusMeters: updated!.radiusMeters,
      description: updated!.description,
      priority: updated!.priority,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Task update failed' });
  }
});

app.post('/api/task/delete', authMiddleware, async (req: AuthedRequest, res) => {
  try {
    if (req.user?.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can delete tasks' });
    }
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: 'taskId is required' });
    }

    const result = await loadOwnedNonTerminalTask(taskId, req.user.orgId);
    if (!result.ok) return res.status(result.status).json({ error: result.message });
    const { task } = result;

    await deleteTask(taskId, task.agentId);

    io.emit('task:deleted:broadcast', { taskId, agentId: task.agentId });
    io.to(task.agentId).emit('task:cancelled', { taskId });

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Task delete failed' });
  }
});

registerSocketHandlers(io);

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await connectRedis();
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`[server] LocalSync backend listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err: any) {
    console.error('[server] failed to start:', err.message);
    process.exit(1);
  }
}

start();
