# TRD — LocalSync (Full Scope, Technical Requirements Doc)

## 1. Tech Stack (final)
| Layer | Choice | Why |
|---|---|---|
| Monorepo | npm workspaces: `apps/backend`, `apps/desktop-web` | One install, one dev command |
| Backend | Node.js + Express + Socket.io (TypeScript) | Real-time + REST in one process |
| Store | **Redis only** — for auth, org, agents, tasks. NO SQL, NO migrations | Keeps everything in one lean, schema-less store; fastest path even with auth/org added |
| Auth | JWT (jsonwebtoken lib), no refresh tokens, 24h expiry | Minimum viable auth, no session store needed beyond the token itself |
| Desktop | Next.js (App Router) — dashboard + owner login/org screens | This IS the desktop app for the demo |
| Map | react-leaflet + Leaflet + OpenStreetMap | No API key |
| Android | Separate repo, builds against `API_CONTRACT.md` | Team split |

## 2. Repo Structure (folder-level ownership to avoid merge conflicts)
```
localsync-core/
├── docker-compose.yml
├── package.json
├── API_CONTRACT.md
├── packages/shared-types/index.ts
└── apps/
    ├── backend/
    │   ├── src/index.ts                  [SHARED — both touch carefully, merge at checkpoints]
    │   ├── src/redisClient.ts            [SHARED]
    │   ├── src/auth/                     [TRACK A — teammate owns entirely]
    │   │   ├── authRoutes.ts             (register/login for owner + agent; agent invite/set-password/resend; org/create/me)
    │   │   ├── authMiddleware.ts         (JWT verify)
    │   │   ├── orgStore.ts               (org + invite code + agent-invite Redis logic)
    │   │   └── mailer.ts                 (Addendum — nodemailer wrapper, console fallback in dev)
    │   └── src/core/                     [TRACK B — you own entirely]
    │       ├── agentStore.ts             (location, status, Redis GEO)
    │       ├── taskStore.ts              (task lifecycle, geofence, ETA)
    │       └── socketHandlers.ts         (all socket.io events)
    └── desktop-web/
        ├── app/
        │   ├── login/page.tsx            [TRACK A]
        │   ├── org/page.tsx              [TRACK A] (create org, show invite code)
        │   ├── dashboard/page.tsx        [TRACK B] (tabbed: Live Ops / Agents / Tasks / Organization)
        │   └── agent/                    [Addendum — TRACK A] (agent onboarding portal, not the Android app)
        │       ├── login/page.tsx        (email + temp/current password)
        │       ├── set-password/page.tsx (forced first-login password reset)
        │       └── onboarded/page.tsx    (confirmation screen)
        ├── components/
        │   ├── MapView.tsx               [TRACK B]
        │   ├── AgentList.tsx             [TRACK B]
        │   ├── DispatchModal.tsx         [TRACK B]
        │   ├── AuthForms.tsx             [TRACK A]
        │   ├── AgentsTable.tsx           [Addendum] (agents management table)
        │   ├── InviteAgentModal.tsx      [Addendum]
        │   ├── TasksTable.tsx            [Addendum] (session-scoped task log)
        │   ├── OrgPanel.tsx              [Addendum] (org info + invite code + counts)
        │   ├── StatTile.tsx              [Addendum] (KPI row)
        │   └── Toast.tsx                 [Addendum] (real-time notifications, e.g. agent:activated)
        └── lib/
            ├── socket.ts                 [TRACK B]
            ├── auth.ts                   [SHARED] (owner session + Addendum: separate agent-portal session)
            └── api.ts                    [SHARED — thin fetch wrapper, agree on shape at Hour 0]
```

## 3. Redis Data Model (full)
| Key pattern | Type | Owner | Purpose |
|---|---|---|---|
| `owner:{ownerId}` | Hash | Track A | `{ email, passwordHash, name, orgId }` |
| `org:{orgId}` | Hash | Track A | `{ name, ownerId, inviteCode }` |
| `invite:{code}` | String | Track A | value = `orgId`, no expiry (MVP) |
| `agent:{agentId}` | Hash | Track B / Addendum | `{ name, email, phone, orgId, passwordHash, online, status, accountStatus, isArchived, lat, lng, currentTaskId, createdAt, updatedAt }` |
| `agentEmail:{email}` | String | Addendum | value = `agentId` — lookup index for email-based agent login/invite uniqueness |
| `agents:geo` | Redis GEO set | Track B | `GEOADD agents:geo lng lat agentId` |
| `task:{taskId}` | Hash | Track B | `{ agentId, destLat, destLng, radiusMeters, status, geoVerified, createdAt }` |

`status` enum for agent: `available \| busy`. `accountStatus` enum for agent (**Addendum**): `invited \| pending_approval \| active \| rejected`:
- `invited` — owner created the agent by email, awaiting the forced first-login password reset (§4a).
- `pending_approval` — agent self-registered via invite code, awaiting owner approval (§4b below) — **this is now the initial state for the invite-code flow**, replacing the old direct-to-`active` behavior.
- `active` — fully onboarded via either path; can log in and be dispatched.
- `rejected` — owner declined a `pending_approval` registration; terminal, login permanently blocked for that account.

`status` enum for task: `pending \| accepted \| rejected \| in_progress \| reached \| completed`.

## 4. Auth Flow & JWT (Track A)

### Endpoints
```
POST /api/owner/register   { email, password, name } -> { ownerId, token }
POST /api/owner/login      { email, password }        -> { ownerId, orgId, token }
POST /api/org/create       { name } (auth: owner token) -> { orgId, inviteCode, token }
GET  /api/org/me           (auth: owner token) -> { orgId, name, ownerId, inviteCode }              [Addendum]
POST /api/agent/register   { inviteCode, name, password } -> { agentId, orgId, accountStatus: 'pending_approval', message }  [response shape changed, see §4b]
POST /api/agent/login      { email or agentId, password } -> 200 { agentId, orgId, token, accountStatus, mustResetPassword }
                                                            -> 403 { error, accountStatus: 'pending_approval' | 'rejected' }  [Addendum, see §4b]
```
- Password: bcrypt hash, minimal rounds (e.g. 8) — speed over paranoia, this is a hackathon demo.
- JWT payload: `{ id, role: 'owner'|'agent', orgId }`, signed with a hardcoded dev secret in `.env` (`JWT_SECRET`), 24h expiry.
- `authMiddleware.ts`: simple Express middleware reading `Authorization: Bearer <token>`, verifies, attaches `req.user`.
- **Socket connections do NOT re-verify JWT per message** (time-saving call, noted explicitly as a scope cut) — agent authenticates once via REST login, then uses the returned `agentId` directly for all socket events. This is acceptable for a demo; document it as a known simplification if judges ask.
- **Known gotcha, fixed**: the owner's register-time token has no `orgId` claim (the org doesn't exist yet). `/api/org/create` therefore mints and returns a **fresh** token with `orgId` baked in — the client must swap it in immediately, or org-scoped endpoints (like `/api/agent/invite`) will 400 even though the org exists. `/api/agent/login`'s `email` param is additive — the original `agentId`-based login (used by `API_CONTRACT.md` / Android) is unchanged.

### 4a. Addendum — Owner-initiated Agent Invite by Email

```
POST /api/agent/invite         (auth: owner) { email, name } -> { agentId, email, name, accountStatus: 'invited' }
POST /api/agent/resend-invite  (auth: owner) { agentId } -> { ok: true }
POST /api/agent/set-password   (auth: agent) { newPassword, confirmPassword } -> { ok: true }
GET  /api/org/agents           (auth: owner) -> Agent[]  (full org roster incl. invited-but-offline agents)
```
- `/api/agent/invite`: validates the org owns the calling token, checks the email isn't already taken (`agentEmail:{email}` index), generates a random system password (`crypto.randomBytes`, readable charset, ambiguous chars excluded), bcrypt-hashes it, creates the agent hash with `accountStatus: 'invited'`, and emails the temp password via `mailer.ts`. Also emits `agents:sync` to all connected sockets so open dashboards update immediately.
- `/api/agent/set-password`: agent-authenticated; requires matching `newPassword`/`confirmPassword`, min 6 chars; flips `accountStatus` to `active`; emits `agent:activated` `{ agentId, name, email, orgId }` to notify the org's dashboard in real time.
- `/api/agent/resend-invite`: owner-only, agent must still be `invited`; regenerates and re-emails a new temp password (no expiry/rate-limit — MVP simplification, same spirit as invite codes).
- **Mailer** (`mailer.ts`): uses `nodemailer`. If `SMTP_HOST` is unset (default), falls back to `jsonTransport` and logs the full rendered email to the console — fully demoable with zero real email infrastructure. Set `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`MAIL_FROM` to send for real. `FRONTEND_URL` (default `http://localhost:3000`) builds the link to `/agent/login` in the invite email.
- **Agent onboarding portal** (`apps/desktop-web/app/agent/*`): a lightweight web substitute for the (out-of-repo) Android app's registration screen, since the owner-driven email flow needs *some* UI for the agent to complete first login + password reset. Uses its own session key (`localsync_agent_session`, via `lib/auth.ts`) separate from the owner's, so both can be logged in in the same browser via different tabs/contexts without clobbering each other.

### 4b. Addendum — Admin Approval Gate for Self-Registration

```
POST /api/agent/approve  (auth: owner) { agentId } -> { ok: true }
POST /api/agent/reject   (auth: owner) { agentId } -> { ok: true }
```
- `/api/agent/register` (self-registration, invite code): **behavior changed** — now creates the agent with `accountStatus: 'pending_approval'` (previously `'active'`) and no longer signs/returns a JWT. Still emits `agents:sync` so the pending registration shows up live in the owner's dashboard.
- `/api/agent/login`: after the password check succeeds (order matters — a wrong password always returns a generic 401 first, so the approval-status check can't be used to enumerate valid agent IDs without a valid password), gates on `accountStatus`:
  - `pending_approval` → `403 { error: '...pending admin approval...', accountStatus: 'pending_approval' }`, no token.
  - `rejected` → `403 { error: '...not approved... contact your organization owner.', accountStatus: 'rejected' }`, no token.
  - `invited` / `active` → unaffected, proceeds as in §4a.
- `/api/agent/approve`: owner-only, must own the agent's org, agent must currently be `pending_approval` (400 otherwise — not a no-op, to surface double-click/stale-UI bugs during testing). Sets `active`, emits **`agent:approved` `{ agentId, name, orgId }`** (a distinct event from `agent:activated` in §4a, since the trigger and copy differ) plus a full `agents:sync` refresh.
- `/api/agent/reject`: same guards, sets `rejected`, emits `agents:sync`. No dedicated `agent:rejected` broadcast event — the `agents:sync` refresh is sufficient since there's no "notify the agent in real time" requirement (they're not connected/online yet at this stage).
- `/api/agent/resend-invite` (§4a) was tightened alongside this: it now requires `accountStatus === 'invited'` specifically (was previously any non-`'active'` status), since a `pending_approval` or `rejected` self-registered agent has no email on file and re-sending an invite email to them would be meaningless/broken.
- **Dashboard**: "Pending Approval" panel (`components/PendingApprovalQueue.tsx`) rendered above the Agents table, listing every `pending_approval` agent with Approve/Reject buttons; a live count badge appears on the "Agents" nav tab itself whenever the queue is non-empty.
- **Does not apply** to the `invited` (email-invite) flow — those agents skip `pending_approval` entirely, since an owner-initiated invite already implies approval.

### 4c. Addendum — Agent Record Management (View / Edit / Archive / Delete)

```
POST /api/agent/update   (auth: owner) { agentId, name?, phone?, email? } -> Agent (full parsed record)
POST /api/agent/archive  (auth: owner) { agentId } -> { ok: true }
POST /api/agent/restore  (auth: owner) { agentId } -> { ok: true }
POST /api/agent/delete   (auth: owner) { agentId } -> { ok: true }
```
- **View** has no dedicated endpoint — the owner's dashboard already holds the full `Agent` object client-side (from `agents:sync` / `GET /api/org/agents`), so the View modal just renders already-fetched fields.
- **`/api/agent/update`**: partial update (`name`/`phone`/`email` all optional). If `email` changes to a non-empty value different from the current one, checks `isAgentEmailTaken` (excluding the no-op case of setting it to its own current value) and swaps the `agentEmail:{email}` index (deletes old mapping if one existed, sets the new one). Emits `agents:sync`.
- **`isArchived`** (new hash field, boolean as string like the rest of the schema) is intentionally orthogonal to `accountStatus` — it's a work-eligibility toggle, not an auth gate. `/api/dispatch` (in `index.ts`, not `authRoutes.ts`) was given a new guard: fetches the agent, 400s with `"Cannot assign tasks to an archived agent"` if `isArchived === 'true'`, *before* creating the task. The dashboard's Dispatch button is disabled for archived agents too (`canDispatch` in `AgentList.tsx` now also checks `!agent.isArchived`) — enforced both client-side (UX) and server-side (the actual guarantee).
- **`/api/agent/delete`**: hard delete — `DEL agent:{agentId}`, `ZREM agents:geo {agentId}`, and `DEL agentEmail:{email}` if the agent had one set. Not soft-deleted; the agent disappears from every list (`getAllAgents()`/`listAgentsByOrg()` naturally exclude it, nothing to filter). A subsequent login attempt with the old credentials gets the same generic `401 "Invalid credentials"` as any wrong-password attempt — deliberately not a distinct "this account was deleted" message, so it can't be used to enumerate which accounts used to exist.
- All four routes emit `agents:sync` — no new socket event types were needed, since the existing full-resync pattern already used by invite/approve/reject naturally handles update/archive/restore/delete too (an update changes a field, a delete just isn't in the next snapshot).
- **UI**: per-row actions collapsed into a "⋮" dropdown menu (`AgentRowActions.tsx`) — View, Edit, Archive/Restore (label swaps based on current `isArchived`), and a destructive Delete (separated by a divider), plus the pre-existing conditional "Resend invite" for `invited`-status agents shown as a standalone button beside the menu. Delete routes through a reusable `ConfirmDialog.tsx` (extracted for future destructive-action reuse, not agent-specific). Click-outside-to-close logic was factored out of `TopBar.tsx` into a shared `lib/useClickOutside.ts` hook once a second dropdown (`AgentRowActions`) needed the same behavior.

## 5. Geofence + ETA Logic (Track B)

### Haversine distance (meters)
```ts
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
```

### On every `location:update`
1. Update Redis (`agents:geo` + agent hash).
2. If agent has an active task (`in_progress`): compute `distance = haversineMeters(agentLat, agentLng, task.destLat, task.destLng)`.
3. `eta = distance / ASSUMED_SPEED_MPS` (hardcode `ASSUMED_SPEED_MPS = 8` i.e. ~29 km/h — good enough for demo).
4. If `distance <= task.radiusMeters` → set task status `reached`, emit `task:reached:broadcast` to Desktop.
5. Broadcast `location:broadcast` to Desktop with `{ agent, distance, eta }` attached.

### On task complete
- Recompute distance at completion moment vs `radiusMeters` → set `geoVerified: true/false` on the task hash.

## 6. Socket.io Event Contract (full, Track B implements)

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `agent:online` | Agent → Backend | `{ agentId }` | JWT already verified at login; agentId is trusted post-login |
| `agent:offline` | Agent → Backend | `{ agentId }` | |
| `location:update` | Agent → Backend | `{ agentId, lat, lng, timestamp }` | Every 3s |
| `location:broadcast` | Backend → Desktop | `{ agent, distance?, eta? }` | distance/eta only present if task in_progress |
| `agents:sync` | Backend → Desktop (on connect) | `Agent[]` | Also re-emitted to everyone after `/api/agent/invite` so a new invited agent appears live [Addendum] |
| `task:dispatch` | Backend → Agent (`io.to(agentId)`) | `{ taskId, destLat, destLng, radiusMeters, description }` | Triggered by REST dispatch |
| `task:accept` | Agent → Backend | `{ agentId, taskId }` | Sets task `in_progress`, agent `busy` |
| `task:reject` | Agent → Backend | `{ agentId, taskId }` | Sets task `rejected`, broadcasts to Desktop |
| `task:reached:broadcast` | Backend → Desktop | `{ agentId, taskId }` | Fired when geofence entered |
| `task:complete` | Agent → Backend | `{ agentId, taskId }` | |
| `task:completed:broadcast` | Backend → Desktop | `{ agentId, taskId, geoVerified }` | |
| `agent:activated` | Backend → Desktop | `{ agentId, name, email, orgId }` | **[Addendum]** Fired by `/api/agent/set-password` on success; dashboard patches the agent's `accountStatus` locally and shows a toast |
| `agent:approved` | Backend → Desktop | `{ agentId, name, orgId }` | **[Addendum]** Fired by `/api/agent/approve`; distinct from `agent:activated` (different trigger/copy) — dashboard patches `accountStatus` to `active` and shows a toast |

## 7. REST Endpoints (Track B)
```
POST /api/dispatch
Body: { agentId, taskId, destLat, destLng, radiusMeters, description }
Auth: owner JWT required
Effect: writes task:{taskId}, emits task:dispatch to agent
```

## 8. Docker Compose
```yaml
version: "3.8"
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

## 9. Shared Types (`packages/shared-types/index.ts`)
```ts
export type AgentStatus = 'available' | 'busy';
export type TaskStatus = 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'reached' | 'completed';
// 'invited'          = owner created the agent by email, awaiting forced first-login password reset.
// 'pending_approval' = agent self-registered via invite code, awaiting owner approval (§4b).
// 'active'           = fully onboarded via either path.
// 'rejected'         = owner declined a pending_approval registration.
export type AccountStatus = 'invited' | 'pending_approval' | 'active' | 'rejected'; // [Addendum]

export interface Agent {
  agentId: string;
  orgId: string;
  name: string;
  email: string;                // [Addendum] '' for invite-code self-registered agents until edited
  phone: string;                // [Addendum] '' by default, editable via /api/agent/update
  online: boolean;
  status: AgentStatus;
  accountStatus: AccountStatus; // [Addendum]
  isArchived: boolean;          // [Addendum] work-eligibility toggle, independent of accountStatus (§4c)
  lat: number;
  lng: number;
  currentTaskId: string | null;
  createdAt: number;            // [Addendum]
  updatedAt: number;
}
export interface Task {
  taskId: string;
  agentId: string;
  destLat: number;
  destLng: number;
  radiusMeters: number;
  description: string;
  status: TaskStatus;
  geoVerified: boolean | null;
  createdAt: number;
}
```

## 10. Definition of Done
- **Track A**: register/login/org-create/invite-code all testable via curl/Postman independently, before Track B integration.
- **Track B**: full socket loop + geofence + ETA testable with a manual test client, independent of real auth (use a hardcoded agentId while Track A finishes).
- **Merge (Hour 3-4)**: Desktop dashboard requires a valid owner JWT to load; agent registration requires a valid invite code from Track A's org creation.
- **Full integration (Hour 5-7)**: real Android app, real registration, full demo script from PRD §6 runs 3x clean.
- **Addendum — Agent email invite**: invite → dev-logged (or real) email → temp-password login → forced set-password → `agent:activated` broadcast, all verified end-to-end via automated browser test, not just curl. Dashboard restructured into tabs (Live Ops / Agents / Tasks / Organization) with a KPI stat row, matching the "professional ops dashboard" bar the original functional-only styling scope cut (§ PRD §5 "styling polish beyond functional forms") explicitly deferred — that cut is now superseded by this addendum for the owner dashboard specifically.
- **Addendum — Admin approval gate**: self-register (`pending_approval`, no token) → login blocked with `403` + correct message → owner approves from the Pending Approval queue in the dashboard UI → `agent:approved` broadcast (live toast + nav badge clears) → login now succeeds with a token → re-approving/re-rejecting an already-decided agent correctly 400s instead of silently no-op'ing. Reject path verified too: blocks login permanently with its own message, table shows a red "Rejected" pill. Verified end-to-end via both curl and an automated real-browser test driving the actual Approve/Reject buttons (not just the API). `API_CONTRACT.md` updated to document the breaking response-shape change for the Android team.
- **Addendum — Agent record management**: Edit persists name/phone/email (with uniqueness + index-swap verified, including the self-email-update no-op case and a genuine collision correctly rejected); Archive blocks `/api/dispatch` with a 400 while leaving login fully functional; Restore reverses it and dispatch works again; Delete removes the agent from `GET /api/org/agents`, blocks subsequent login with a generic `401`, and frees the email for reuse by a new invite. Verified end-to-end via curl AND an automated real-browser test driving the actual "⋮" actions menu (View/Edit/Archive/Restore/Delete) and the delete confirmation dialog — not just the API.
