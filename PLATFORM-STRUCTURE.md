# golive.wiki — Platform Structure & Integration Map

> Generated from the live source tree at `/tmp/golivewiki` (repo: `github.com/koraussie7/golivewiki`).
> Verified against the running backend on `http://localhost:4100` (health 200, full auth round-trip passing).

---

## 1. High-Level System Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │              CLIENTS                        │
                          └─────────────────────────────────────────────┘

   ┌──────────────────────────────┐        ┌──────────────────────────────┐
   │   WEB  (Next.js 16 App)      │        │  MOBILE  (Expo / RN)         │
   │   :3000                      │        │  iOS / Android               │
   │                              │        │                              │
   │  app/                        │        │  App.tsx                     │
   │   ├ page.tsx          (home) │        │   ├ screens/                 │
   │   ├ login/  register/        │        │   │   ├ LoginScreen          │
   │   ├ dashboard/               │        │   │   ├ RegisterScreen       │
   │   │   ├ page.tsx      (map)  │        │   │   └ MapScreen            │
   │   │   ├ create/              │        │   ├ context/AuthContext      │
   │   │   ├ my-gigs/             │        │   ├ hooks/useLocation        │
   │   │   └ task/[id]/           │        │   ├ hooks/useSocket          │
   │   ├ map-test/                │        │   └ services/socket          │
   │   └ error/loading/not-found  │        │                              │
   │                              │        │  api/client.ts  (axios)      │
   │  lib/apiClient.ts  (fetch)   │        │  SecureStore (JWT)           │
   │  components/TaskMap (Leaflet)│        │  react-native-maps           │
   └───────────┬──────────────────┘        └───────────┬──────────────────┘
               │                                        │
               │  HTTPS REST + WebSocket (socket.io)    │
               │  Authorization: Bearer <JWT>           │
               └────────────────┬───────────────────────┘
                                │
                                ▼
            ┌───────────────────────────────────────────────┐
            │        BACKEND API   (Express 5 + TS)         │
            │        :4100   (env PORT)                     │
            │                                               │
            │  index.ts                                     │
            │   ├ cors  (golive.wiki, localhost:3000/3001)  │
            │   ├ express.json()                            │
            │   ├ /api/auth     → auth.routes               │
            │   ├ /api/users    → user.routes               │
            │   ├ /api/tasks    → task.routes               │
            │   ├ /api/reviews  → review.routes             │
            │   ├ /api/health                               │
            │   └ httpServer + Socket.io                    │
            │                                               │
            │  middleware/auth.middleware.ts  (verifyToken) │
            │  services/socket.service.ts     (emitToUser)  │
            │  services/redis.service.ts      (GEO)         │
            │  db.ts  (Prisma + pg adapter)                 │
            └────────┬──────────────────────────┬───────────┘
                     │                          │
                     ▼                          ▼
        ┌────────────────────────┐   ┌────────────────────────┐
        │  PostgreSQL 16         │   │  Redis 7               │
        │  host :5433 → :5432    │   │  :6379                 │
        │  db: gig_db            │   │                        │
        │  user: gig_admin       │   │  key: provider_locations│
        │                        │   │   GEOADD / GEOSEARCH   │
        │  Models:               │   │   (geo index only;     │
        │   • User               │   │    no persistence)     │
        │   • Task               │   │                        │
        │   • Review             │   └────────────────────────┘
        └────────────────────────┘
```

---

## 2. Data Model (Prisma)

```
  ┌──────────────────────────────┐
  │            USER              │
  ├──────────────────────────────┤
  │ id         String  (uuid) PK │
  │ email      String  UNIQUE    │
  │ password   String  (bcrypt)  │
  │ firstName  String            │
  │ lastName   String            │
  │ role       Role    (enum)    │
  │ phone      String?           │
  │ createdAt / updatedAt        │
  └──────┬──────────┬────────────┘
         │          │
         │ 1:N      │ 1:N
         │ (client) │ (provider)
         ▼          ▼
  ┌──────────────────────────────┐
  │            TASK              │
  ├──────────────────────────────┤
  │ id          String  PK       │
  │ title       String           │
  │ description String           │
  │ price       Float            │
  │ status      TaskStatus (enum)│
  │ latitude    Float            │
  │ longitude   Float            │
  │ address     String?          │
  │ clientId    String  FK ──────┼──► User (ClientTasks)
  │ providerId  String? FK ──────┼──► User (ProviderTasks)
  │ createdAt / updatedAt        │
  └──────┬───────────────────────┘
         │ 1:1
         ▼
  ┌──────────────────────────────┐
  │           REVIEW             │
  ├──────────────────────────────┤
  │ id        String PK          │
  │ rating    Int    (1..5)      │
  │ comment   String?            │
  │ taskId    String UNIQUE FK   │──► Task
  │ authorId  String FK ─────────┼──► User (ReviewAuthor)
  │ subjectId String FK ─────────┼──► User (ReviewSubject)
  └──────────────────────────────┘

  ENUMS
    Role       = CLIENT | PROVIDER | ADMIN
    TaskStatus = OPEN | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
```

**Note:** `Task.latitude/longitude` are stored in **Postgres** for display, while Redis holds a separate **geo index** used only for radius search. The two can drift — a known design seam.

---

## 3. API Surface (all verified live)

| Method | Path                        | Auth   | Handler           | Notes                                          |
| ------ | --------------------------- | ------ | ----------------- | ---------------------------------------------- |
| GET    | `/api/health`               | —      | index.ts          | ✅ 200                                         |
| POST   | `/api/auth/register`        | —      | auth.controller   | needs `firstName,lastName,email,password,role` |
| POST   | `/api/auth/login`           | —      | auth.controller   | returns JWT                                    |
| PUT    | `/api/users/location`       | Bearer | user.controller   | **PROVIDER only** (403 otherwise)              |
| POST   | `/api/tasks`                | Bearer | task.controller   | needs `price,latitude,longitude`               |
| GET    | `/api/tasks`                | Bearer | task.controller   | returns **OPEN** tasks only                    |
| GET    | `/api/tasks/my-gigs`        | Bearer | task.controller   | provider's `ASSIGNED` tasks                    |
| GET    | `/api/tasks/:id`            | Bearer | task.controller   | single task + client/provider                  |
| PUT    | `/api/tasks/:id/accept`     | Bearer | task.controller   | OPEN → ASSIGNED                                |
| PUT    | `/api/tasks/:id/complete`   | Bearer | task.controller   | own tasks → COMPLETED                          |
| POST   | `/api/reviews/:taskId`      | Bearer | review.controller | task must be COMPLETED                         |
| GET    | `/api/reviews/task/:taskId` | —      | review.controller |                                                |
| GET    | `/api/reviews/user/:userId` | —      | review.controller | returns `avgRating`                            |

### Real-time events (Socket.io)

```
  Client connects with  auth: { token: <JWT> }  ──►  JWT verified in io.use()
                                                      userId attached to socket
                                                      connectedUsers.set(userId, socketId)

  SERVER → PROVIDER   "new_task_available"  { taskId, title, price, distance }
                      (fired when a task is created within 10 km — Redis GEOSEARCH)

  SERVER → CLIENT     "task_accepted"       { taskId, message }
                      (fired when a provider accepts)
```

---

## 4. Task Lifecycle

```
   CLIENT posts task                                PROVIDER
        │                                              │
        ▼                                              ▼
   ┌─────────┐   Redis GEOSEARCH(10km)   ┌────────────────────────┐
   │  OPEN   │ ─────────────────────────►│ "new_task_available"   │
   └────┬────┘   emitToUser(provider)    └───────────┬────────────┘
        │                                            │
        │                                            ▼
        │                                   PUT /tasks/:id/accept
        ▼                                            │
   ┌───────────┐   "task_accepted" ◄─────────────────┘
   │ ASSIGNED  │
   └────┬──────┘
        │  PUT /tasks/:id/complete   (provider, own task)
        ▼
   ┌───────────┐
   │ COMPLETED │
   └────┬──────┘
        │  POST /reviews/:taskId  (client or provider)
        ▼
   ┌──────────┐
   │  REVIEW  │  rating 1–5, avgRating aggregated per user
   └──────────┘

   Side branch:  CANCELLED   (enum present, no endpoint wired yet)
```

---

## 5. Runtime & Infra

```
  ┌─────────────────────────────────────────────────────────────┐
  │  docker-compose.yml                                         │
  ├─────────────────────────────────────────────────────────────┤
  │  postgres:16   ports "5433:5432"   POSTGRES_PASSWORD=...    │
  │  redis:7       ports "6379:6379"                            │
  └─────────────────────────────────────────────────────────────┘

  PORTS
    backend          :4100   (env PORT)
    web-client       :3000   (next dev)
    postgres         :5433 → 5432
    redis            :6379
    mobile           Metro :8081 (Expo)

  ENV FILES (required — none committed)
    backend/.env          DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_EXPIRES_IN, PORT
    web-client/.env.local NEXT_PUBLIC_API_URL
    mobile-client/.env    EXPO_PUBLIC_API_HOST
```

---

## 6. Integration Seams (what connects what)

| #   | Seam            | Wiring                                                                |
| --- | --------------- | --------------------------------------------------------------------- |
| 1   | Web → API       | `src/lib/apiClient.ts` → `API_BASE_URL` (env `NEXT_PUBLIC_API_URL`)   |
| 2   | Web → Socket    | `dashboard/page.tsx` → `io(NEXT_PUBLIC_API_URL, { auth: { token } })` |
| 3   | Mobile → API    | `src/api/client.ts` → axios `baseURL` (env `EXPO_PUBLIC_API_HOST`)    |
| 4   | Mobile → Socket | `src/services/socket.ts` → `io(SOCKET_URL)`                           |
| 5   | Client → DB     | `db.ts` → Prisma + `@prisma/adapter-pg` Pool (`DATABASE_URL`)         |
| 6   | Task → Geo      | `task.controller.createTask` → `redis.geoAdd` on `provider_locations` |
| 7   | Geo → Notify    | `findNearbyProviders` → `emitToUser` → socket                         |
| 8   | Auth            | `verifyToken` middleware ↔ `socket.io` `io.use` share `JWT_SECRET`    |

---

## 7. Known Gaps / Seams to Watch

| Area                        | Issue                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Stale `dist/`**           | Backend `dist/*.js` can drift from `src/*.ts`; rebuild before deploy                                    |
| **Dual geo source**         | Lat/lng duplicated in Postgres _and_ Redis — no sync guarantee                                          |
| **CORS allowlist**          | Hardcoded to `golive.wiki` + `localhost:3000/3001`; backend runs on `4100`, so local dev needs it added |
| **No `/jobs` or `/offers`** | Airtasker-style offer/bid flow is absent (only direct accept)                                           |
| **`CANCELLED` unused**      | Enum value has no endpoint                                                                              |
| **No pagination**           | `GET /api/tasks` returns all OPEN tasks                                                                 |
| **No refresh token**        | Single 7-day JWT, no rotation/revocation                                                                |
| **Redis not persistent**    | Provider locations lost on restart                                                                      |
| **Mobile REST hardcoded**   | Now env-driven, but `EXPO_PUBLIC_*` must be set per device (LAN IP, not `localhost`)                    |

---

## 8. Directory Layout

```
golivewiki/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        User / Task / Review + enums
│   │   └── migrations/
│   ├── docker-compose.yml       postgres:5433, redis:6379
│   ├── tsconfig.json            outDir dist/ (rootDir "./" → dist/src/index.js)
│   └── src/
│       ├── index.ts             express + cors + socket bootstrap
│       ├── db.ts                Prisma + pg Pool
│       ├── middleware/auth.middleware.ts
│       ├── routes/              auth | task | user | review
│       ├── controllers/         auth | task | user | review
│       └── services/            redis (GEO) | socket (emit)
│
├── web-client/                  Next.js App Router
│   ├── .env.local               NEXT_PUBLIC_API_URL
│   └── src/
│       ├── app/
│       │   ├── page.tsx         landing
│       │   ├── login/ register/
│       │   ├── dashboard/       map + create + my-gigs + task/[id]
│       │   └── map-test/
│       ├── components/TaskMap.tsx   Leaflet + tile fallback chain
│       └── lib/apiClient.ts         fetch + Bearer from localStorage
│
└── mobile-client/               Expo / React Native
    └── src/
        ├── api/client.ts        axios + SecureStore JWT interceptor
        ├── context/AuthContext.tsx
        ├── hooks/               useLocation | useSocket
        ├── screens/             Login | Register | Map
        └── services/socket.ts
```
