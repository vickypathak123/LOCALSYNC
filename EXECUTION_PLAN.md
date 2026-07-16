# Execution Plan — LocalSync (8 Hours, 2-Person Parallel Split)

**Track A** = backend teammate (Auth + Org + Invite Code)
**Track B** = you, SR (Core real-time loop + Desktop dashboard + Geofence/ETA)
Android dev works independently in their own repo against `API_CONTRACT.md`.

---

## Hour 0–1 — Shared Blueprint (BOTH together)
- [ ] Create `localsync-core` repo, npm workspaces, folder structure (TRD §2) — agree on folder ownership boundaries right now, out loud
- [ ] `docker-compose.yml` (Redis), `docker-compose up -d`, confirm `redis-cli ping` → `PONG`
- [ ] `packages/shared-types/index.ts` — paste from TRD §9, freeze
- [ ] `API_CONTRACT.md` — fill in local IP, send to Android dev **immediately**, don't wait for anything else
- [ ] Agree on the thin `apps/desktop-web/lib/api.ts` fetch wrapper shape (so Track A's endpoints and Track B's calls match without a later rewrite)
- **Split starts now.**

## Hour 1–3 — Track A (parallel)
- [ ] `authRoutes.ts`: `/api/owner/register`, `/api/owner/login`, `/api/org/create`, `/api/agent/register`, `/api/agent/login`
- [ ] `authMiddleware.ts`: JWT verify middleware
- [ ] `orgStore.ts`: Redis read/write for `owner:*`, `org:*`, `invite:*`
- [ ] Test every endpoint via curl/Postman independently — do NOT wait for Track B
- [ ] `desktop-web/app/login/page.tsx` + `org/page.tsx`: bare-minimum forms (no styling effort) that call these endpoints, show invite code on screen after org creation

## Hour 1–3 — Track B (parallel)
- [ ] `agentStore.ts`: Redis GEO + agent hash helpers
- [ ] `taskStore.ts`: task hash helpers + `haversineMeters()` + ETA calc (TRD §5)
- [ ] `socketHandlers.ts`: `agent:online/offline`, `location:update` → Redis + broadcast, `agents:sync`
- [ ] Test with a manual test client (fake `agentId`, ignore auth for now) — confirm location broadcasts reach a dummy desktop listener
- [ ] `desktop-web/app/dashboard/page.tsx` skeleton + `MapView.tsx` — render markers from `agents:sync`

## Hour 3–4 — MERGE CHECKPOINT (BOTH together, ~30-45 min)
- [ ] Wire `authMiddleware` onto the `/api/dispatch` route (owner-only)
- [ ] Wire dashboard page to require a valid JWT (redirect to `/login` if missing) — minimal check, not bulletproof
- [ ] Track B's `agent:online` handler now expects a real `agentId` that Track A's registration produced — quick smoke test: register a real agent via Track A's endpoint, then emit `agent:online` with that ID, confirm Track B's pipeline still works unchanged
- [ ] Commit & push both tracks now — this is the sync point, not before
- **If either track is behind here**: cut the geofence radius drawing UI or the org "pretty" screen first — never cut the register→dispatch→track loop itself.

## Hour 4–5 — Track B continues: Task lifecycle + Geofence/ETA
- [ ] `POST /api/dispatch` — full implementation with destLat/destLng/radiusMeters
- [ ] `socketHandlers.ts`: `task:accept`, `task:reject`, `task:complete`, geofence check inside `location:update` handler, `task:reached:broadcast`, `task:completed:broadcast`
- [ ] `AgentList.tsx` + dashboard: Dispatch button (destination + radius input, even a raw prompt() is fine), live distance/ETA display, status labels

## Hour 4–5 — Track A continues (support role)
- [ ] Polish invite-code display flow, org creation UX just enough to be legible on stream
- [ ] Help Track B test the auth-gated dispatch flow
- [ ] Prep to assist Android dev if they hit registration/login issues (Track A owns that contract)

## Hour 5–7 — Full Integration (BOTH + Android)
- [ ] Real Android app connects: register with real invite code → login → go online
- [ ] Full demo script (PRD §6) run end-to-end: dispatch → accept/reject → track → geofence → complete → geo-verified status
- [ ] Run this loop 3x clean, with a fresh Redis restart once in between to catch any state-reliance bugs
- **This IS your demo. If this works reliably, core scope is done.**

## Hour 7–8 — Freeze & Demo Prep
- [ ] **Hard code freeze**, no exceptions
- [ ] Full clean restart test: `docker-compose down && up`, restart backend + desktop-web + Android app, re-run demo script
- [ ] Confirm local IP hasn't changed (reconnect Wi-Fi can reassign it)
- [ ] Rehearse click-by-click sequence across both screens (owner desktop + agent phone side by side)
- [ ] Record a backup video of one clean successful run

---

## Fallback Cuts (priority order if behind schedule)
1. Cut first: org/invite "pretty" screens — hardcode a single org/invite code if Track A falls behind
2. Cut next: ETA display (keep distance only, drop the speed-based estimate)
3. Cut next: `task:reached:broadcast` (agent can just tap Complete manually, skip auto-detection banner)
4. Never cut: register→login→dispatch→accept→location→complete core loop

## How to Run (for judges, <60 seconds)
```bash
docker-compose up -d
npm install
npm run dev
```
Open `http://localhost:3000/login` (Owner), have the Android app already logged in and online on the connected device/emulator.
