import redisClient from '../redisClient';
import { Agent, AgentStatus, AccountStatus } from '../../../../packages/shared-types';

export async function setAgentLocation(agentId: string, lat: number, lng: number): Promise<void> {
  await redisClient.geoAdd('agents:geo', { longitude: lng, latitude: lat, member: agentId });
  await redisClient.hSet(`agent:${agentId}`, {
    lat: lat.toString(),
    lng: lng.toString(),
    updatedAt: Date.now().toString(),
  });
}

export async function setAgentOnline(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { online: 'true', updatedAt: Date.now().toString() });
}

export async function setAgentOffline(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { online: 'false', updatedAt: Date.now().toString() });
}

export async function setAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { status, updatedAt: Date.now().toString() });
}

export function parseAgent(agentId: string, raw: Record<string, string>): Agent {
  return {
    agentId,
    orgId: raw.orgId,
    name: raw.name,
    email: raw.email || '',
    phone: raw.phone || '',
    online: raw.online === 'true',
    status: (raw.status as AgentStatus) || 'available',
    accountStatus: (raw.accountStatus as AccountStatus) || 'active',
    isArchived: raw.isArchived === 'true',
    lat: parseFloat(raw.lat) || 0,
    lng: parseFloat(raw.lng) || 0,
    currentTaskId: raw.currentTaskId ? raw.currentTaskId : null,
    createdAt: parseInt(raw.createdAt, 10) || 0,
    updatedAt: parseInt(raw.updatedAt, 10) || 0,
  };
}

export async function getAgent(agentId: string): Promise<Agent | null> {
  const raw = await redisClient.hGetAll(`agent:${agentId}`);
  if (!raw || Object.keys(raw).length === 0) return null;
  return parseAgent(agentId, raw);
}

export async function getAllAgents(): Promise<Agent[]> {
  const agents: Agent[] = [];
  for await (const key of redisClient.scanIterator({ MATCH: 'agent:*' })) {
    const raw = await redisClient.hGetAll(key);
    if (raw && Object.keys(raw).length > 0) {
      agents.push(parseAgent(key.replace('agent:', ''), raw));
    }
  }
  return agents;
}
