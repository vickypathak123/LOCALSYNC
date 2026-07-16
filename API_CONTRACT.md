# LocalSync — API Contract (Backend ↔ Android)

Freeze this by end of Hour 1. Send to Android dev immediately — they build registration/login screens and the task flow purely against this.

## Connection
- Base URL: `http://30.0.254.174:3011` — current dev machine LAN IP + port. **Re-confirm on demo day** (Wi-Fi reconnects can reassign the IP; run `ipconfig getifaddr en0` on the backend machine to recheck) and whenever the backend host changes.
- Both devices (backend machine + Android device/emulator) must be on the **same Wi-Fi network** — this address is only reachable on the local network, not from the internet.
- WebSocket: same host, Socket.io client, default path

## REST Endpoints (Android calls these directly)

### Register agent
```
POST /api/agent/register
Body: { "inviteCode": "string", "name": "string", "mobile": "string", "password": "string" }
Response: { "agentId": "string", "orgId": "string", "accountStatus": "pending_approval", "message": "string" }
```
`inviteCode` comes from the Owner (shown on their Desktop dashboard after creating an org). User types it in during app onboarding. `mobile` is the agent's mobile number (e.g. `"9876543210"`) — required, and must be unique across the org's agents (a duplicate returns `400 { "error": "An agent with this mobile number already exists" }`).

**⚠️ Addendum — approval gate (breaking change from the original contract):** registration **no longer returns a token** and does **not** log the user in. The account is created in `pending_approval` status and must be approved by the org's owner (from their dashboard's "Agents" tab) before the agent can sign in at all. Show the `message` field to the user ("Your registration is pending admin approval…") and route them to a waiting/blocked screen — do not proceed to the main app.

**⚠️ Addendum — `mobile` field (breaking change):** the mobile-number field was added after the initial freeze, replacing `agentId` as the login identifier below. It is now a **required** registration field.

### Login agent
```
POST /api/agent/login
Body: { "mobile": "string", "password": "string" }
Response (200, approved): { "agentId": "string", "orgId": "string", "token": "string", "accountStatus": "active", "mustResetPassword": false }
Response (403, still pending): { "error": "Your account is pending admin approval. Please wait until your registration is approved.", "accountStatus": "pending_approval" }
Response (403, declined): { "error": "Your registration was not approved. Please contact your organization owner.", "accountStatus": "rejected" }
```

**⚠️ Addendum — login now keys off `mobile` (breaking change from the original contract):** the agent logs in with the same mobile number they registered with, not `agentId` — the app never needs to know its own `agentId` until the register/login response returns one. (The old `{ "agentId", "password" }` body still works server-side as a fallback, but new client code should send `mobile`.)

**Handle all three cases**: on `200`, proceed as normal and store `token`/`agentId`. On `403` with `accountStatus: "pending_approval"`, show the same waiting screen as after registration (poll by retrying login, e.g. on a "Refresh status" button or pull-to-refresh — there's no push notification for approval). On `403` with `accountStatus: "rejected"`, show the error message as a terminal state (no retry path — they'd need a new invite/registration).

Store `token` and `agentId` locally after a successful (200) register/login. Token isn't needed again for socket events (see below) — just keep `agentId`.

## Socket Events — Android EMITS

### `agent:online`
```json
{ "agentId": "string" }
```
Send once after login, when user taps "Go Online".

### `agent:offline`
```json
{ "agentId": "string" }
```

### `location:update`
```json
{ "agentId": "string", "lat": 21.1702, "lng": 72.8311, "timestamp": 1234567890 }
```
Every 3 seconds while online. Simulated movement is fine.

### `task:accept`
```json
{ "agentId": "string", "taskId": "string" }
```
Send when user taps "Accept" on a task alert.

### `task:reject`
```json
{ "agentId": "string", "taskId": "string" }
```
Send when user taps "Reject".

### `task:complete`
```json
{ "agentId": "string", "taskId": "string", "delayReason": "string (optional, see below)" }
```
Send when user taps "Complete" on the destination-tracking screen.

**⚠️ Addendum — delay grace period + mandatory reason (breaking change):** the backend now computes a fixed `estimatedArrivalAt` (acceptance time + the first ETA it saw) per task and tracks a 15-minute grace period past it. If more than 15 minutes have elapsed since `estimatedArrivalAt` when Complete is tapped, **this event is rejected** — the task does *not* complete, and the backend replies with `task:complete:rejected` (see below) instead of `task:completed:broadcast`. Show a "Why the delay?" text prompt in that case, collect a reason, and resend `task:complete` with `delayReason` filled in. Outside the grace period, `delayReason` is optional and ignored if sent.

### `task:reached:broadcast` *(optional to show, but nice if you have time)*
```json
{ "agentId": "string", "taskId": "string" }
```
Backend detected the agent entered the geofence — you can show a small "You've arrived" banner, then let the user tap Complete.

## Socket Events — Android LISTENS

### `task:dispatch`
```json
{ "taskId": "string", "destLat": 21.18, "destLng": 72.84, "radiusMeters": 200, "description": "string", "priority": "low" | "medium" | "high" | "urgent" }
```
Show a task alert with Accept/Reject buttons. On Accept, transition the app to a "destination tracking" screen and keep sending `location:update`.

**Additive field:** `priority` was added after the initial freeze (dashboard task-priority feature). It always defaults to `"medium"` server-side if the owner's dashboard doesn't set one, so it's always present — safe to ignore if the Android app doesn't display it yet.

### `task:complete:rejected` *(new — addendum, see task:complete above)*
```json
{ "taskId": "string", "reason": "delay_reason_required", "message": "string (show this directly to the user)" }
```
Sent **to the completing agent only** (not broadcast) when `task:complete` is rejected for missing a delay reason past the grace period. Prompt for a reason and resend `task:complete` with `delayReason` set — there's no retry limit.

## Notes
- No JWT verification happens on socket events — once logged in via REST, all socket messages just use plain `agentId`. This is a deliberate hackathon time-saving simplification, not an oversight.
- `agentId`: returned from register/login, persist it locally (SharedPreferences or similar) for the session.
- Reconnection: Socket.io auto-reconnects; re-emit `agent:online` on reconnect.

## Quick test before building real UI
Use Postman to hit `/api/agent/register` with a test invite code (get one from the Owner desktop flow first), confirm you get back an `agentId` and `accountStatus: "pending_approval"`. Then have the Owner approve the agent from their dashboard's Agents tab (or ask them to, since only the org owner can). Only after that will `/api/agent/login` succeed with a `token` — retrying login before approval should return the `403 pending_approval` response, which is expected, not a bug. Once logged in, use any Socket.io test client to emit `agent:online` + `location:update` and confirm it shows up on the Desktop dashboard, before wiring your actual app screens.
