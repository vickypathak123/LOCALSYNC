# PRD — LocalSync (8-Hour Sprint, Full Scope)

## 1. Problem & Goal
LocalSync is a real-time field-ops coordination system: an Owner manages an Organization of Agents, dispatches geofenced tasks, and tracks live movement, ETA, and geo-verified completion.

## 2. Team & Repo Split
| Person | Repo | Owns |
|---|---|---|
| Backend teammate | `localsync-core` (Track A) | Owner/Agent auth, Organization, Invite Code — all Redis-backed |
| You (SR) | `localsync-core` (Track B) | Socket real-time loop, Desktop dashboard (map, dispatch, accept/reject), Geofence + ETA logic |
| Android dev | Separate repo | Native Android app, builds against `API_CONTRACT.md` |
| Shared | Docker (Redis) | Single source of truth, both tracks read/write it |

**Merge checkpoint: Hour 3-4** — Track A's auth endpoints must be ready (even stubbed) so Track B can protect the dispatch endpoint and the Android dev can start testing registration.

## 3. Users & Roles
| Role | Interface | Capabilities |
|---|---|---|
| Owner | Desktop Web | Register, login, create org, generate invite code, view live map, dispatch tasks, track ETA/distance, see completion status |
| Agent | Android app (separate repo) | Register via invite code, login, go online, accept/reject tasks, send location, complete task |

## 4. Full Feature Scope (in scope)
1. Owner registration + login (JWT, no email verification, no password reset)
2. Organization creation (Owner only, one org per owner for MVP)
3. Invite code generation (6-digit code, tied to org, no expiry logic — keep simple)
4. Agent registration via invite code + login (**Addendum, §4c**: now gated behind owner approval — see below)
5. Agent online/offline toggle, availability status (Available/Busy)
6. Live location streaming every 3s
7. Owner creates task: assign agent + destination coordinates + geofence radius
8. Agent receives task alert → Accept or Reject
9. Reject → Owner notified instantly, can reassign
10. Accept → Agent status → Busy, location stream continues toward destination
11. Owner sees live distance (Haversine) + simple ETA (distance ÷ assumed avg speed)
12. Geofence check on every location update — if agent enters radius, mark "Destination Reached"
13. Agent completes task → capture last known location → geo-verify against geofence
14. Owner sees "Completed — Geo Verified" or "Completed — Not Geo Verified"
15. Agent status reverts to Available
16. **(Addendum)** Owner can invite an agent directly by email from the dashboard's Agents tab — alternate path alongside invite-code self-registration (see §4b)
17. **(Addendum)** Self-registered agents (invite-code path) require owner approval before their first login succeeds (see §4c)

## 4b. Addendum — Agent Onboarding via Email Invite

Added after the initial build, as a professional-dashboard upgrade to the Owner experience. This is **additive** — the original invite-code + Android self-registration flow (§4 items 3–4) is unchanged and still fully supported. This is a second, owner-initiated path for the same outcome (an agent assigned to the org, ready to work).

**Flow:**
1. Owner opens the dashboard's **Agents** tab and invites an agent by name + email.
2. Backend generates a system password, creates the agent record in `invited` status, and emails the agent their email + temporary password (SMTP if configured, else the email is logged to the console in dev — no real inbox required to demo).
3. Agent opens the onboarding portal, signs in with the temporary password.
4. Agent is forced onto a "set new password" screen (new password + confirm password); mismatches and passwords under 6 characters are rejected client- and server-side.
5. On success, the agent's account flips from `invited` to `active`, and the org's dashboard is notified **in real time** (toast notification + live status update in the Agents table) — no page refresh needed.
6. The agent is now assigned to the organization and ready to go online and receive tasks — this path skips the admin-approval gate in §4c below, since the owner already vetted them by name/email before inviting.

**Explicitly NOT in scope for this addendum** (to avoid scope creep back into cut territory from §5):
- No "forgot password" flow for already-active agents — this is a one-time onboarding password set, not a general password-reset feature.
- No email address verification/confirmation step — the temporary password sent to the address *is* the verification (whoever has inbox access can complete onboarding).
- No resend-invite rate limiting or invite expiry — resending just issues a fresh temporary password.

## 4c. Addendum — Admin Approval Gate for Self-Registration

Added after §4b, closing a trust gap: self-registration via invite code (§4 item 4) previously activated the agent immediately on submission — anyone with the 6-digit code (which has no expiry and is shared informally) could get instant access. This addendum inserts an owner approval step **only** on that path.

**Flow:**
1. Agent submits `POST /api/agent/register` (invite code + name + password) as before.
2. Account is created in **`pending_approval`** status — **not** `active`, and the response **no longer returns a login token** (this is a breaking change from the original response shape, documented in `API_CONTRACT.md`).
3. The registration appears live in the owner's dashboard, in a dedicated **"Pending Approval"** panel at the top of the Agents tab (with a badge count on the tab itself), showing name and request time.
4. Owner clicks **Approve** or **Reject**.
   - Approve → `accountStatus` → `active`; dashboard broadcasts this in real time (same toast/live-update pattern as §4b); agent can now log in normally.
   - Reject → `accountStatus` → `rejected`; a terminal state — the agent cannot retry login with that account (would need a fresh registration).
5. Until approved, `POST /api/agent/login` returns **403** with a specific message: *"Your account is pending admin approval. Please wait until your registration is approved."* (or the rejected-state equivalent). This applies regardless of which client calls it (Android app or otherwise) — the gate lives in the backend, not any one UI.

**Does NOT apply to** the owner-invited email flow (§4b) — an owner-initiated invite is itself the approval; those agents only pass through the `invited → active` password-reset gate, never `pending_approval`.

**Explicitly NOT in scope**: no reason/comment field on rejection, no email notification to the agent when approved/rejected (the agent only finds out by retrying login), no bulk approve.

## 4d. Addendum — Agent Record Management (View / Edit / Archive / Delete)

Added after §4c, giving owners full lifecycle control over agent records from the Agents table's per-row actions menu.

**View**: read-only detail panel — name, email, phone, live status, account status, current task, agent/org IDs, registered/updated timestamps. No editing from this screen.

**Edit**: name, phone, and email are editable (owner-only). **"Role" was explicitly not implemented** — this system has no agent sub-roles to choose between (see §5 "Role permissions beyond Owner/Agent binary", still out of scope), so there's nothing for a role field to select. Editing email re-validates uniqueness against other agents in the same org and moves the internal email→agent lookup index; setting it back to its own current value is a safe no-op, not a false "already taken" error.

**Archive / Inactivate**: a new `isArchived` flag, deliberately **independent of `accountStatus`** (§4b/§4c) — archiving does not affect login:
- Archived agent can still log in normally.
- Cannot be assigned new tasks — `/api/dispatch` rejects with a 400 if the target agent is archived; the dashboard's Dispatch button is disabled for them too (defense in depth, not just a UI-level restriction).
- Shown as a clear gray **"Inactive"** indicator everywhere the agent appears (Agents table, Live Ops sidebar), replacing the normal online/offline live-status display.
- Reversible via **Restore** (the natural complement — not explicitly requested but a dead-end one-way archive would be poor UX, so both directions are supported).

**Delete**: permanent removal, gated behind a confirmation dialog.
- Agent record is fully erased from the store (not soft-deleted) — removed from the org's Agents table (active or archived), the live map, and login stops working immediately (generic "Invalid credentials", not a distinct "deleted" message — doesn't reveal the account ever existed).
- Their email becomes available again for a fresh invite or self-registration — rejoining requires a brand-new registration/invite, not a reactivation of the old record.
- Any task records the agent was previously assigned to are left as-is (task history isn't queried by agent identity elsewhere, so no cleanup was needed — consistent with task history being session-scoped, §5).

## 5. Explicitly OUT of scope (still cut, no negotiation)
- Email verification, forgot-password, refresh tokens
- Multiple organizations per owner, multiple owners per org
- Task history persistence beyond current session (nice-to-have only if time remains)
- Role permissions beyond Owner/Agent binary
- Styling polish beyond functional forms
- Real map-matching / routing (ETA is a straight-line estimate, not road-based)

## 6. Demo Script (4-5 min, expanded)
1. Owner registers → logs in → creates org → sees invite code.
1b. *(Addendum, optional)* Owner switches to the **Agents** tab → invites a second agent by email → shows the console-logged (or real) invite email → agent signs in on the onboarding portal with the temp password → sets a new password → owner's dashboard shows a live "Agent activated" toast, no refresh.
2. Android app: agent registers with that invite code → logs in → "Go Online".
3. Owner dashboard: agent appears as green marker, "Available".
4. Owner clicks agent → sets destination + geofence radius → assigns task.
5. Android: task alert pops up → Accept.
6. Owner dashboard: status → "Busy", ETA/distance counters appear.
7. Agent (simulated movement) approaches destination → distance shrinks live.
8. Agent enters geofence → dashboard shows "Destination Reached".
9. Agent taps "Complete" → dashboard shows "Completed — Geo Verified".
10. Agent status reverts to "Available".

## 7. Success Criteria (judging-aligned)
- **Real-time flow (40%)**: location + distance/ETA update live, no refresh.
- **End-to-end workflow (30%)**: full loop — register → dispatch → accept → track → geofence → complete — works across two independently-built apps.
- **Speed/resourcefulness (20%)**: Redis-only backend (no SQL/migrations even for auth/org), parallel team split to fit real scope into 8 hours, API contract frozen early to unblock Android team.
- **Demo stability (10%)**: rehearsed, code-frozen last hour.

## 8. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Auth/org eats more time than budgeted | Track A teammate works in strict isolation from Track B; if behind at Hour 4 checkpoint, fall back to a hardcoded single owner + single org (skip registration UI, keep only agent invite-code + login) |
| Two people editing same repo → conflicts | Strict folder ownership (see TRD repo structure), commit/push at each checkpoint, not continuously |
| Geofence math bugs (radius check wrong) | Use simple Haversine distance ≤ radius check — do NOT attempt polygon geofences or map-based drawing |
| Android blocked without contract | `API_CONTRACT.md` frozen Hour 1, includes auth endpoints now — sent immediately |
