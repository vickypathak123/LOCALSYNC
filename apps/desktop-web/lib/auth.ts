const SESSION_KEY = 'localsync_session';
const AGENT_SESSION_KEY = 'localsync_agent_session';

export interface Session {
  token: string;
  ownerId: string;
  orgId: string;
  inviteCode?: string;
  ownerName?: string;
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Partial<Session>): Session {
  const current = getSession();
  const next = { ...current, ...session } as Session;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

// --- Agent onboarding portal session (separate from the owner session above) ---

export interface AgentSession {
  token: string;
  agentId: string;
  orgId: string;
  mustResetPassword: boolean;
}

export function getAgentSession(): AgentSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AGENT_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentSession;
  } catch {
    return null;
  }
}

export function setAgentSession(session: Partial<AgentSession>): AgentSession {
  const current = getAgentSession();
  const next = { ...current, ...session } as AgentSession;
  window.localStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearAgentSession(): void {
  window.localStorage.removeItem(AGENT_SESSION_KEY);
}
