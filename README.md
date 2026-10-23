# GoLive Smart Glass Task MVP

Starter module for a GoLive workflow where a requester posts a task and a smart-glasses wearer accepts it, streams a live view, and receives bounded instructions.

## What is included
- TypeScript/React requester + worker demo screen.
- Express API with task create/list/accept, instruction creation, and event history.
- Shared TypeScript data types.
- MediaMTX integration notes for live video.
- Safety defaults: no remote device control, no background recording, explicit wearer acceptance, and task-scoped access are required before production.

## Important limitations
This is a starter scaffold, not a production-ready deployment. The API uses in-memory storage and has no authentication, database, payment processing, or WebRTC token issuance. Do not expose it publicly or use it with real users until those are implemented. The live video panel is a placeholder; connect your chosen glasses app/SDK to MediaMTX separately.

## Requirements
- Node.js 20+
- npm

## Run the API
```bash
cd server
npm install
npm run dev
```
API listens on `http://localhost:4100`.

## Run the UI
In another terminal:
```bash
cd web
npm install
npm run dev
```
Open the local URL printed by Vite.

## Suggested production integration
1. Move the `web/src` UI into GoLive's existing route/component structure.
2. Replace in-memory arrays in `server/src/index.ts` with GoLive's existing database and authentication.
3. Enforce requester/worker ownership on every API endpoint.
4. Use short-lived, task-scoped video credentials; never expose MediaMTX admin credentials to browsers.
5. Add an explicit wearer consent indicator and a visible pause/stop-stream control.
6. Keep AI suggestions separate from device actions. Start with task text, OCR, translation, and user-approved snapshots; do not implement covert recording or remote control of glasses.
7. Add audit logs, rate limits, retention controls, and tests before production.

## Task flow
`POST /api/tasks` -> worker `POST /api/tasks/:id/accept` -> requester/worker exchange instructions via `POST /api/tasks/:id/instructions` -> event timeline via `GET /api/tasks/:id/events`.

## Example task
```json
{
  "title": "Read a sign and translate it",
  "description": "Please inspect the sign in front of the shop and tell me what it says.",
  "category": "translation",
  "locationLabel": "Da Nang, Vietnam",
  "budget": 5,
  "currency": "USD"
}
```


## Data model recommendation
Use existing GoLive user IDs. Suggested entities: `smartglass_tasks`, `smartglass_task_members`, `smartglass_task_events`, `smartglass_consents`, `smartglass_video_sessions`. Store consent timestamp, consent scope, expiry, and revocation. Do not store raw video by default.

## Suggested validation
- worker cannot accept their own task
- only authenticated task members can read task events
- only accepted/in-progress tasks can create video sessions
- video session creation fails unless current wearer consent is true
- consent revocation invalidates the video session
- task is claimed atomically to prevent two workers accepting at once
- rate limit instructions and validate text length
- never trust requester/worker IDs from request JSON; derive actor ID from auth middleware
