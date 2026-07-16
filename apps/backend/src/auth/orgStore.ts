import crypto from 'crypto';
import redisClient from '../redisClient';

export async function createOwner(email: string, passwordHash: string, name: string): Promise<string> {
  const ownerId = crypto.randomUUID();
  await redisClient.hSet(`owner:${ownerId}`, {
    email,
    passwordHash,
    name,
    orgId: '',
  });
  return ownerId;
}

export async function getOwnerByEmail(
  email: string
): Promise<{ ownerId: string; email: string; passwordHash: string; name: string; orgId: string } | null> {
  for await (const key of redisClient.scanIterator({ MATCH: 'owner:*' })) {
    const owner = await redisClient.hGetAll(key);
    if (owner.email === email) {
      const ownerId = key.replace('owner:', '');
      return {
        ownerId,
        email: owner.email,
        passwordHash: owner.passwordHash,
        name: owner.name,
        orgId: owner.orgId,
      };
    }
  }
  return null;
}

export async function createOrg(ownerId: string, name: string): Promise<{ orgId: string; inviteCode: string }> {
  const orgId = crypto.randomUUID();
  const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();

  await redisClient.hSet(`org:${orgId}`, {
    name,
    ownerId,
    inviteCode,
  });
  await redisClient.set(`invite:${inviteCode}`, orgId);
  await redisClient.hSet(`owner:${ownerId}`, { orgId });

  return { orgId, inviteCode };
}

export async function getOrgById(
  orgId: string
): Promise<{ orgId: string; name: string; ownerId: string; inviteCode: string } | null> {
  const org = await redisClient.hGetAll(`org:${orgId}`);
  if (!org || Object.keys(org).length === 0) return null;
  return { orgId, name: org.name, ownerId: org.ownerId, inviteCode: org.inviteCode };
}

export async function validateInviteCode(code: string): Promise<string | null> {
  const orgId = await redisClient.get(`invite:${code}`);
  return orgId || null;
}

// --- Self-serve registration (invite code, used by the Android app) ---

export async function isAgentPhoneTaken(phone: string): Promise<boolean> {
  const exists = await redisClient.exists(`agentPhone:${phone}`);
  return exists === 1;
}

export async function getAgentByPhone(
  phone: string
): Promise<(Record<string, string> & { agentId: string }) | null> {
  const agentId = await redisClient.get(`agentPhone:${phone}`);
  if (!agentId) return null;
  const agent = await redisClient.hGetAll(`agent:${agentId}`);
  if (!agent || Object.keys(agent).length === 0) return null;
  return { agentId, ...agent };
}

export async function createAgent(orgId: string, name: string, passwordHash: string, phone: string): Promise<string> {
  const agentId = crypto.randomUUID();
  const now = Date.now().toString();
  await redisClient.hSet(`agent:${agentId}`, {
    name,
    email: '',
    phone,
    orgId,
    passwordHash,
    online: 'false',
    status: 'available',
    accountStatus: 'pending_approval',
    isArchived: 'false',
    lat: '0',
    lng: '0',
    currentTaskId: '',
    createdAt: now,
    updatedAt: now,
  });
  await redisClient.set(`agentPhone:${phone}`, agentId);
  return agentId;
}

export async function approveAgent(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { accountStatus: 'active', updatedAt: Date.now().toString() });
}

export async function rejectAgent(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { accountStatus: 'rejected', updatedAt: Date.now().toString() });
}

export async function getAgentById(agentId: string): Promise<Record<string, string> | null> {
  const agent = await redisClient.hGetAll(`agent:${agentId}`);
  if (!agent || Object.keys(agent).length === 0) return null;
  return agent;
}

// --- Owner-initiated email invite (dashboard "Agents" module) ---

export async function isAgentEmailTaken(email: string): Promise<boolean> {
  const exists = await redisClient.exists(`agentEmail:${email.toLowerCase()}`);
  return exists === 1;
}

export async function createAgentInvite(
  orgId: string,
  email: string,
  name: string,
  passwordHash: string
): Promise<string> {
  const agentId = crypto.randomUUID();
  const now = Date.now().toString();
  await redisClient.hSet(`agent:${agentId}`, {
    name,
    email,
    phone: '',
    orgId,
    passwordHash,
    online: 'false',
    status: 'available',
    accountStatus: 'invited',
    isArchived: 'false',
    lat: '0',
    lng: '0',
    currentTaskId: '',
    createdAt: now,
    updatedAt: now,
  });
  await redisClient.set(`agentEmail:${email.toLowerCase()}`, agentId);
  return agentId;
}

export async function getAgentByEmail(
  email: string
): Promise<(Record<string, string> & { agentId: string }) | null> {
  const agentId = await redisClient.get(`agentEmail:${email.toLowerCase()}`);
  if (!agentId) return null;
  const agent = await redisClient.hGetAll(`agent:${agentId}`);
  if (!agent || Object.keys(agent).length === 0) return null;
  return { agentId, ...agent };
}

export async function updateAgentPasswordHash(agentId: string, passwordHash: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { passwordHash, updatedAt: Date.now().toString() });
}

export async function activateAgentPassword(agentId: string, passwordHash: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, {
    passwordHash,
    accountStatus: 'active',
    updatedAt: Date.now().toString(),
  });
}

export async function listAgentsByOrg(orgId: string): Promise<Array<Record<string, string> & { agentId: string }>> {
  const results: Array<Record<string, string> & { agentId: string }> = [];
  for await (const key of redisClient.scanIterator({ MATCH: 'agent:*' })) {
    const agent = await redisClient.hGetAll(key);
    if (agent.orgId === orgId) {
      results.push({ agentId: key.replace('agent:', ''), ...agent });
    }
  }
  return results;
}

// --- Edit / Archive / Delete (dashboard "Agents" management actions) ---

export async function updateAgentDetails(
  agentId: string,
  updates: { name?: string; phone?: string; email?: string },
  previousEmail: string,
  previousPhone: string
): Promise<void> {
  const fields: Record<string, string> = { updatedAt: Date.now().toString() };
  if (updates.name !== undefined) fields.name = updates.name;

  if (updates.email !== undefined && updates.email !== previousEmail) {
    fields.email = updates.email;
    if (previousEmail) {
      await redisClient.del(`agentEmail:${previousEmail.toLowerCase()}`);
    }
    if (updates.email) {
      await redisClient.set(`agentEmail:${updates.email.toLowerCase()}`, agentId);
    }
  }

  if (updates.phone !== undefined && updates.phone !== previousPhone) {
    fields.phone = updates.phone;
    if (previousPhone) {
      await redisClient.del(`agentPhone:${previousPhone}`);
    }
    if (updates.phone) {
      await redisClient.set(`agentPhone:${updates.phone}`, agentId);
    }
  }

  await redisClient.hSet(`agent:${agentId}`, fields);
}

export async function archiveAgent(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { isArchived: 'true', updatedAt: Date.now().toString() });
}

export async function restoreAgent(agentId: string): Promise<void> {
  await redisClient.hSet(`agent:${agentId}`, { isArchived: 'false', updatedAt: Date.now().toString() });
}

export async function deleteAgent(agentId: string, email: string, phone: string): Promise<void> {
  await redisClient.del(`agent:${agentId}`);
  await redisClient.zRem('agents:geo', agentId);
  if (email) {
    await redisClient.del(`agentEmail:${email.toLowerCase()}`);
  }
  if (phone) {
    await redisClient.del(`agentPhone:${phone}`);
  }
}
