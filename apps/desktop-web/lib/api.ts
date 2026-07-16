import type { Agent, AccountStatus, TaskPriority, Task } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011';

export class ApiError extends Error {
  accountStatus?: AccountStatus;

  constructor(message: string, accountStatus?: AccountStatus) {
    super(message);
    this.accountStatus = accountStatus;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // The login endpoint attaches accountStatus on 403s (pending_approval / rejected)
    // so callers can distinguish "wrong password" from "not approved yet" and show
    // the right message instead of a generic auth failure.
    throw new ApiError(data.error || `Request failed with status ${res.status}`, data.accountStatus);
  }

  return data as T;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface OwnerRegisterResponse {
  ownerId: string;
  token: string;
  name: string;
}

export interface OwnerLoginResponse {
  ownerId: string;
  orgId: string;
  token: string;
  name: string;
}

export interface OrgCreateResponse {
  orgId: string;
  inviteCode: string;
  token: string;
}

export interface DispatchPayload {
  agentId: string;
  taskId?: string;
  destLat: number;
  destLng: number;
  radiusMeters: number;
  description: string;
  priority: TaskPriority;
}

export interface DispatchResponse {
  ok: boolean;
  taskId: string;
}

export interface AgentInviteResponse {
  agentId: string;
  email: string;
  name: string;
  accountStatus: AccountStatus;
}

export interface AgentLoginResponse {
  agentId: string;
  orgId: string;
  token: string;
  accountStatus: AccountStatus;
  mustResetPassword: boolean;
}

export function registerOwner(email: string, password: string, name: string) {
  return request<OwnerRegisterResponse>('/api/owner/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export function loginOwner(email: string, password: string) {
  return request<OwnerLoginResponse>('/api/owner/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function createOrg(name: string, token: string) {
  return request<OrgCreateResponse>('/api/org/create', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ name }),
  });
}

export function dispatchTask(payload: DispatchPayload, token: string) {
  return request<DispatchResponse>('/api/dispatch', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(payload),
  });
}

// Every task hash persists in Redis forever, so this single call restores both
// "active tasks after a dashboard refresh" and full task history in one shot.
export function getOrgTasks(token: string) {
  return request<Task[]>('/api/org/tasks', {
    headers: authHeader(token),
  });
}

export interface OrgInfo {
  orgId: string;
  name: string;
  ownerId: string;
  inviteCode: string;
}

export function getOrgMe(token: string) {
  return request<OrgInfo>('/api/org/me', {
    headers: authHeader(token),
  });
}

// --- Agents management (owner) ---

export function inviteAgent(email: string, name: string, token: string) {
  return request<AgentInviteResponse>('/api/agent/invite', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ email, name }),
  });
}

export function resendAgentInvite(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/resend-invite', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

export function listOrgAgents(token: string) {
  return request<Agent[]>('/api/org/agents', {
    headers: authHeader(token),
  });
}

export function approveAgent(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/approve', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

export function rejectAgent(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/reject', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

export interface UpdateAgentPayload {
  name?: string;
  phone?: string;
  email?: string;
}

export function updateAgent(agentId: string, payload: UpdateAgentPayload, token: string) {
  return request<Agent>('/api/agent/update', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId, ...payload }),
  });
}

export function archiveAgent(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/archive', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

export function restoreAgent(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/restore', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

export function deleteAgent(agentId: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/delete', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ agentId }),
  });
}

// --- Agent onboarding portal ---

export function loginAgentByEmail(email: string, password: string) {
  return request<AgentLoginResponse>('/api/agent/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function setAgentPassword(newPassword: string, confirmPassword: string, token: string) {
  return request<{ ok: boolean }>('/api/agent/set-password', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ newPassword, confirmPassword }),
  });
}
