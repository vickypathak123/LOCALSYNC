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
import { createTask, listTasksByOrg } from './core/taskStore';

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
