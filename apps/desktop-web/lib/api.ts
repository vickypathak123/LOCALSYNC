import type { Agent, AccountStatus, TaskPriority, Task, GeocodeResult, GeocodeSuggestion } from './types';

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

export interface UpdateTaskPayload {
  description?: string;
  priority?: TaskPriority;
  radiusMeters?: number;
  destLat?: number;
  destLng?: number;
}

// Backend rejects this for a completed/rejected task — only pending/accepted/
// in_progress/reached tasks are editable.
export function updateTask(taskId: string, payload: UpdateTaskPayload, token: string) {
  return request<Task>('/api/task/update', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ taskId, ...payload }),
  });
}

export function deleteTask(taskId: string, token: string) {
  return request<{ ok: boolean }>('/api/task/delete', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify({ taskId }),
  });
}

// Address/place-name typeahead for the dispatch modal's destination picker.
// Empty/short queries are cheap no-ops server-side, but callers should still
// debounce — this fires a real upstream request per call. `proximity` biases
// ranking toward that point (nearest-first) — omit it for a plain search.
// `sessionToken` must stay the same across every suggest call and the
// eventual geocodeRetrieve for one search (Mapbox's session/billing model) —
// mint a fresh one per search session, not per keystroke.
export function geocodeSuggest(
  query: string,
  sessionToken: string,
  token: string,
  proximity?: { lat: number; lng: number }
) {
  const params = new URLSearchParams({ q: query, sessionToken });
  if (proximity) {
    params.set('lat', String(proximity.lat));
    params.set('lng', String(proximity.lng));
  }
  return request<GeocodeSuggestion[]>(`/api/geocode/suggest?${params.toString()}`, {
    headers: authHeader(token),
  });
}

// Resolves one chosen suggestion to real coordinates. Only needed for
// suggestions that didn't already carry lat/lng (see GeocodeSuggestion) —
// callers should skip this call entirely when they did.
export function geocodeRetrieve(id: string, sessionToken: string, token: string) {
  const params = new URLSearchParams({ id, sessionToken });
  return request<GeocodeResult>(`/api/geocode/retrieve?${params.toString()}`, {
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
