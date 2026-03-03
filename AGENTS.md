# HYCU — LMS Lecture Attendance Automation

Automates HYCU University LMS (`lms.hycu.ac.kr`) lecture attendance.
Two execution paths: **CLI** (Playwright browser automation, local) and
**CF Workers** (serverless API, Hono + Cloudflare Workers). Both share the same
dashboard at `hycu.pages.dev`.

## Quick Reference

| Item | Value |
|------|-------|
| Runtime (CLI) | Node.js + TypeScript 5.7 (strict, ES2022, ESM) |
| Runtime (Workers) | Cloudflare Workers + Hono (ES2022, Workers runtime) |
| Browser | Playwright 1.50 (Chromium, persistent context) — CLI only |
| Dashboard | Cloudflare Workers + KV (`hycu.pages.dev`) |
| CLI Entry | `tsx src/index.ts <command>` |
| CLI Commands | `login`, `attend`, `api-attend`, `status` |
| Workers API | `https://hycu.pages.dev/api/{health,session,status,attend,sync}` |
| Cron Trigger | `0 23 * * 1-5` (Mon–Fri 08:50 KST) — auto attendance |
| Build (CLI) | `tsc` → `dist/` |
| Build (Workers) | `wrangler deploy` |
| Config (CLI) | `.env` (dotenv) — credentials + FIDO keys |
| Config (Workers) | `web/wrangler.toml` — KV binding + vars; `API_KEY` secret via CLI |
| Session (CLI) | `cookies/` dir — Playwright storage state |
| Session (Workers) | KV key `session:cookies` — pushed via `scripts/push-cookies.ts` |

## Directory Map

```
hycu/
hycu/
├── src/                        # CLI application source (8 files, flat)
│   ├── index.ts                # CLI entry — command router (login/attend/status)
│   ├── config.ts               # Environment loader, URL constants, FIDO config
│   ├── browser.ts              # Playwright context factory + cookie persistence
│   ├── login.ts                # FIDO/PIN SSO authentication flow
│   ├── attend.ts               # Course discovery + video attendance automation
│   ├── api-attend.ts            # Pure API attendance (no Playwright, fetch-based)
│   ├── status.ts               # Course progress display (table output)
│   └── sync.ts                 # Dashboard sync — POSTs state to CF Pages API
├── web/                        # Cloudflare Workers dashboard + serverless API
│   ├── wrangler.toml           # CF Workers config, KV namespace, vars, assets, cron triggers
│   ├── package.json            # Dashboard deps (hono) + deploy scripts
│   ├── tsconfig.json           # ES2022, @cloudflare/workers-types
│   ├── src/                    # Workers application source (Hono)
│   │   ├── index.ts            # Hono app entry — route registration + middleware + scheduled handler
│   │   ├── types.ts            # Shared type definitions (Env, SessionData, etc.)
│   │   ├── middleware/
│   │   │   └── auth.ts         # CORS + Bearer token auth middleware
│   │   ├── routes/             # Hono route handlers
│   │   │   ├── health.ts       # GET /api/health — service health check
│   │   │   ├── session.ts      # GET/POST/DELETE /api/session — cookie management
│   │   │   ├── status.ts       # GET /api/status — course progress (cached 5min)
│   │   │   ├── attend.ts       # POST /api/attend — serverless attendance
│   │   │   └── sync.ts         # POST /api/sync — CLI state sync receiver
│   │   └── lib/                # Shared library modules
│   │       ├── constants.ts    # URL constants, year/semester, KV key names
│   │       ├── lms.ts          # LMS API: token, courses, progress fetchers
│   │       ├── session.ts      # KV session CRUD + validation
│   │       └── attendance.ts   # Lesson schedules + saveStdyRecord.do caller
│   └── public/
│       └── index.html          # Self-contained dark-theme dashboard UI (Korean)
├── scripts/                    # Operational + diagnostic scripts
│   ├── push-cookies.ts         # Reads CLI cookies → POSTs to /api/session
│   ├── capture-sso-dom.ts      # SSO diagnostic: DOM capture
│   └── diagnose-sso*.ts        # SSO diagnostic: v1, v2, v3 iterations
├── .github/                    # CI/CD
│   └── workflows/
│       └── deploy.yml          # GitHub Actions: esbuild bundle + wrangler pages deploy
├── data/                       # Reference material (HAR captures, extracted JS)
│   ├── *.har                   # Network captures from LMS/SSO
│   └── *.js                    # Extracted site JS for reverse-engineering
├── cookies/                    # Playwright storage state (gitignored)
├── .env                        # CLI credentials (HYCU_USER_ID, FIDO_*, dashboard keys)
├── tsconfig.json               # strict, ES2022, ESNext modules, bundler resolution
└── package.json                # build/start/login/attend/status/push-cookies scripts
```

## Architecture

### Dual Execution Paths

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Path (local)                          │
│                                                             │
│  tsx src/index.ts <cmd>                                     │
│    ├── "login"  → login.ts  → SSO FIDO auth → save cookies │
│    ├── "attend" → attend.ts → Playwright video playback     │
│    ├── "api-attend" → api-attend.ts → Pure API attendance  │
│    └── "status" → status.ts → fetch + print table           │
│         ↓ (each command)                                    │
│    sync.ts → POST /api/sync → update dashboard state        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│             CF Workers Path (serverless)                     │
│                                                             │
│  push-cookies.ts → POST /api/session → store in KV          │
│                                                             │
│  Dashboard UI (hycu.pages.dev)                               │
│    ├── GET  /api/status  → fetch courses from LMS via KV session │
│    ├── POST /api/attend  → submit attendance records via API │
│    └── GET  /api/health  → service health check              │
│                                                             │
│  Session flow:                                               │
│    CLI login → cookies/ → push-cookies.ts → KV → Workers use │
└─────────────────────────────────────────────────────────────┘
```

### CLI: Browser Lifecycle

Every CLI command creates a Playwright persistent browser context via `browser.ts`:
1. Launches Chromium with `cookies/` as `userDataDir`
2. Session state (cookies + localStorage) persists across runs
3. `login` must run first to establish session; `attend`/`status` check for valid session

### Workers: Session Lifecycle

1. CLI `login` creates cookies in `cookies/session.json`
2. `scripts/push-cookies.ts` reads cookies, groups by domain, POSTs to `/api/session`
3. Workers save cookies to KV directly (no pre-validation — CF Workers IP triggers SSO redirect)
4. All API endpoints read session from KV key `session:cookies`
5. Sessions expire when LMS server invalidates them (redirect to SSO = expired)

### External Services

| Service | Domain | Purpose |
|---------|--------|---------|
| LMS | `lms.hycu.ac.kr` | Main learning platform |
| Road | `road.hycu.ac.kr` | Course content delivery, token API |
| SSO | `sso.hycu.ac.kr` | SAML authentication |
| FIDO | `fido.hycu.ac.kr:28444` | FIDO key-based auth API |
| Dashboard | `hycu.pages.dev` | Progress dashboard (CF Workers + KV) |

## CLI Module Details

### `config.ts`
- Loads `.env` via dotenv
- Exports frozen config object with URLs + FIDO credentials
- All URL constants defined here — no hardcoded URLs elsewhere

### `login.ts` — SSO Authentication
Authentication chain: SSO → FIDO server → PIN entry → SAML redirect

**Critical implementation details:**
- **MagicSA KeyStore**: Stored in localStorage at key `dreamsecurity/magicsa/keyStore`, NOT in cookies. The login flow injects this via `page.evaluate()` before triggering FIDO auth.
- **PIN input bypass**: The `#pinNo` field has `readonly` attribute. Flow: remove readonly → set value → dispatch `input`+`change` events → restore readonly.
- **SAML redirect chain**: SSO → IDP processing → SSO callback → road.hycu.ac.kr. Uses 30-second timeout for the full chain.
- **FIDO API calls**: Direct `fetch()` inside page context to `fido.hycu.ac.kr:28444` for key registration/authentication.

### `attend.ts` — Lecture Attendance (largest CLI module, ~495 lines)
Orchestrates the full attendance workflow via Playwright:

1. **Session check**: Navigates to LMS; if redirected to SSO domain → session expired → exit
2. **Course discovery**: Fetches enrolled courses from road.hycu.ac.kr API
3. **Lesson filtering**: Filters to open weeks (lessonStartDt <= today, ltDetmToDtMax >= today) with progress < 100%
4. **Lecture playback**:
   - Opens lecture viewer (iframe-based)
   - Sets video playback rate to 2×
   - Monitors network responses to `saveStdyRecord.do`
   - Considers lesson complete when response contains `result=100`
5. **Loop**: Processes all unattended lessons sequentially

### `status.ts` — Progress Display
- Fetches course list + completion data from road.hycu.ac.kr
- Renders progress table to stdout
- **Hardcoded values**: `YEAR="2026"`, `SEMESTER="10"` — must update for different terms

### `sync.ts` — Dashboard Sync
- Best-effort POST to `HYCU_DASHBOARD_URL/api/sync` after each CLI command
- Sends action type, success status, and course progress data
- 10-second timeout; failures are non-fatal (logged to console, never throws)

### `api-attend.ts` — Pure API Attendance (no Playwright)
Submits attendance records via direct HTTP API calls without browser automation:

1. **Session**: Reads cookies from `cookies/session.json` (Playwright storage state format)
2. **Token**: Fetches auth token from road.hycu.ac.kr `/pot/MainCtr/findToken.do`
3. **Courses**: Gets enrolled courses from LMS API
4. **Lesson filtering**: Same as `attend.ts` — open weeks + not yet attended
5. **Attendance submission**: HAR-verified dual-call pattern to `saveStdyRecord.do`:
   - Two sequential POST requests ~2s apart with slightly different timing parameters
   - `requiredMinutes = Math.ceil(lbnTm * 0.55)` — 55% safety margin over 50% threshold
   - `result >= 1` treated as success (record saved)
6. **Speed**: ~15 seconds total for 6 courses (vs ~33 minutes via Playwright video playback)

Usage: `npm run api-attend` (requires prior `npm run login`)

## Workers Module Details

### `web/src/types.ts` — Shared Types
Defines all types used across Workers:
- `Env`: `HYCU_KV` (KVNamespace), `API_KEY` (string), `HYCU_USER_ID` (string)
- `AppEnv`: Hono environment type `{ Bindings: Env }`
- `SessionData`: `roadCookies`, `lmsCookies`, `savedAt`
- `CourseProgress`: `crsCreCd`, `name`, `progressRatio`, `attendCount`, `totalCount`
- `LessonSchedule`: schedule/time/content IDs, `title`, `pageCount`, `attended`, `progressRatio`, `lbnTm` (lecture duration minutes), date fields
- `AttendResult`, `DashboardState`, `RunEvent`, `SyncPayload`

### `web/src/index.ts` — Hono App Entry + Scheduled Handler
- Creates Hono app with `cors({ origin: '*' })` middleware
- Applies auth middleware to `/api/*` routes
- Mounts route sub-apps: health, session, status, attend, sync at `/api/`
- Exports `scheduled` handler for Cron Triggers — runs full attendance flow automatically
- Cron schedule: `0 23 * * 1-5` (UTC) = Mon–Fri 08:50 KST

### `web/src/lib/constants.ts` — Shared Constants
```typescript
ROAD_BASE = 'https://road.hycu.ac.kr'
LMS_BASE  = 'https://lms.hycu.ac.kr'
SSO_BASE  = 'https://sso.hycu.ac.kr'
YEAR = '2026', SEMESTER = '10'
KV_KEYS = { session: 'session:cookies', state: 'dashboard:state', events: 'dashboard:events' }
```

### `web/src/lib/lms.ts` — LMS API Client
- `fetchToken(roadCookies)` — Gets auth token from Road API (`/pot/MainCtr/findToken.do`)
- `fetchCoursesWithProgress(token, userNo)` — Lists enrolled courses with progress from LMS API

### `web/src/lib/session.ts` — Session Management
- `getSession(kv)` / `saveSession(kv, session)` / `clearSession(kv)` — KV CRUD
- `checkSession(roadCookies)` — Validates session by hitting Road mainView, checking for SSO redirects

### `web/src/lib/attendance.ts` — Attendance Engine
- `fetchLessonSchedules(lmsCookies, crsCreCd, userNo)` — Gets lesson list with schedule details
- `saveAttendanceRecord(lmsCookies, userNo, crsCreCd, lesson)` — Submits attendance via `saveStdyRecord.do`

**Attendance calculation logic:**
- `lbnTm` = lecture duration in minutes (from LMS API)
- `requiredMinutes = Math.ceil(lbnTm * 0.55)` — 55% safety margin over 50% threshold
- LMS attendance rule: `studyTotalTm / lbnTm >= 50%` → recognized as attended
- **Dual-call pattern** (HAR-verified): sends two sequential `saveStdyRecord.do` requests ~2s apart with slightly different parameters (simulates real playback progression)
- URL: `POST /lesson/stdy/saveStdyRecord.do` (verified from HAR captures)
- Response: `{"result":1}` = success (record saved). Result ≥ 1 treated as success.

### `web/src/middleware/auth.ts` — Auth Middleware
- Hono `createMiddleware` — applied to all `/api/*` routes
- Bypasses `/api/health` (public endpoint)
- **API_KEY guard**: Returns 500 if `API_KEY` env var is not configured (prevents auth bypass)
- POST/DELETE requests require `Authorization: Bearer <API_KEY>`
- GET/OPTIONS requests pass through

### `web/src/routes/health.ts` — Health Check
- `GET /api/health` → `{ status: "ok", service: "hycu-dashboard", timestamp }`

### `web/src/routes/session.ts` — Cookie Management
- `GET /api/session` → Check if stored session is valid (hits Road API)
- `POST /api/session` → Store `{ roadCookies, lmsCookies }` in KV (validates before saving)
- `DELETE /api/session` → Clear session from KV

### `web/src/routes/status.ts` — Course Progress
- `GET /api/status` → Fetches courses + progress from LMS, caches in KV (5-min TTL)
- `GET /api/status?refresh=true` → Bypasses cache
- Falls back to cached state on error or expired session
- Uses `c.executionCtx.waitUntil()` for non-blocking KV cache writes

### `web/src/routes/attend.ts` — Serverless Attendance
- `POST /api/attend` → Processes all unattended lessons across all courses
- Iterates courses → fetches lessons → filters unattended → submits attendance records (dual-call pattern)
- 500ms delay between submissions (rate-limit guard)
- Uses `c.executionCtx.waitUntil()` for non-blocking KV persistence of event log + dashboard state
- Returns `{ success, results[], logs[], summary }`

### `web/src/routes/sync.ts` — CLI Sync Receiver
- `POST /api/sync` → Receives CLI state updates (action, timestamp, courses)
- Updates dashboard state + appends to event log (max 50 events)
- Uses `c.executionCtx.waitUntil()` for non-blocking KV writes
- Used by CLI `sync.ts` after each command

## Scripts

### `scripts/push-cookies.ts` — Session Bridge
Bridges CLI sessions to Workers:
1. Reads `cookies/session.json` (Playwright storage state)
2. Groups cookies by domain (`road.hycu.ac.kr`, `lms.hycu.ac.kr`)
3. Converts to `name=value; name=value` header format
4. POSTs to `/api/session` with Bearer auth

Usage: `npm run push-cookies` (requires prior `npm run login`)

### `scripts/diagnose-sso*.ts` — SSO Diagnostics
Debug scripts for SSO flow failures. Capture DOM state and diagnose authentication issues.
Not used in production.

## Dashboard UI

`web/public/index.html` — Self-contained dark-theme SPA (Korean language):
- Stats cards: 전체 과목 / 완료 / 진도율
- Last activity timestamps (마지막 로그인, 출석, 동기화)
- Course progress table with visual bars
- Session management: status indicator, API key modal for authentication
- 출석 실행 button: triggers `POST /api/attend` from browser
- Event log with action history
- Auto-refresh every 60 seconds

## Environment Variables

### CLI (`.env`)

| Variable | Purpose |
|----------|---------|
| `HYCU_USER_ID` | Student ID for SSO login |
| `HYCU_USER_NAME` | Student name |
| `FIDO_KEY_ID` | FIDO authentication key identifier |
| `FIDO_KEY_VALUE` | FIDO authentication key value |
| `FIDO_REG_DATA` | FIDO registration data blob |
| `HYCU_DASHBOARD_URL` | Dashboard API base URL (`https://hycu.pages.dev`) |
| `HYCU_API_KEY` | Bearer token for dashboard sync API |

### Workers (`wrangler.toml` + secrets)

| Variable | Source | Purpose |
|----------|--------|---------|
| `HYCU_USER_ID` | `wrangler.toml` `[vars]` | Student ID (same as CLI) |
| `API_KEY` | `wrangler secret put API_KEY` | Bearer token for POST/DELETE auth |
| `HYCU_KV` | KV namespace binding | Session + state storage |

KV namespace ID: `7c5384c1ab3547aca7d3b29ebedc68c9`

## Common Tasks

### Run attendance (CLI)
```bash
npm run login         # Establish SSO session (requires PASS verification)
npm run attend        # Process all unattended lectures via Playwright
npm run api-attend    # Process via API calls (faster, no browser needed)
npm run status        # Check progress
```


### Deploy dashboard
Deploys automatically via GitHub Actions on push to `web/**`.
Manual deploy:
```bash
npm run dashboard:deploy
```


### Change semester

### Change semester
Update `YEAR` and `SEMESTER` constants in **both**:
- `src/status.ts` (CLI)
- `web/src/lib/constants.ts` (Workers)

### Debug SSO issues
Use scripts in `scripts/` — they capture DOM state and diagnose SSO flow failures.

### Run attendance (API-only, no Playwright)
```bash
npm run login         # Establish session first
npm run api-attend    # Submit attendance via API (~15 seconds)
npm run push-cookies  # Push session to Workers
```

## Conventions

- **No subdirectories in `src/`** — flat module structure, each file = one responsibility
- **Workers modules** — Hono framework; `lib/` for shared logic, `routes/` for handlers, `middleware/` for auth
- **Console output**: Direct `console.log()` for CLI user feedback, no logging library
- **Error handling**: Try/catch at command level (CLI), per-route (Workers)
- **No tests**: No test framework configured
- **No linting**: No ESLint/Prettier/Biome configured
- **Korean UI**: Dashboard and API error messages in Korean

## Pitfalls

1. **Session expiry**: Cookies expire server-side. If `attend` or `status` fail with SSO redirect, re-run `login` then `push-cookies`.
2. **FIDO key rotation**: If FIDO keys change on the server side, `.env` values must be updated manually.
3. **Hardcoded semester**: Both `src/status.ts` and `web/src/lib/constants.ts` have hardcoded year/semester — must update both for different terms.
4. **Playwright version**: FIDO auth flow depends on specific page structure; Playwright/Chromium upgrades may break selectors.
5. **Network timeouts**: SAML redirect chain uses 30s timeout; slow SSO server can cause false failures.
6. **Video playback detection** (CLI only): Relies on `saveStdyRecord.do` response format — LMS API changes break completion detection.
7. **Attendance parameters**: `saveStdyRecord.do` requires precise field set including `lbnTm`, `studyCnt`, `playStartDttm`. Missing fields cause silent failures (HTTP 200 but no attendance recorded).
8. **Workers session validation**: POST `/api/session` saves cookies without pre-validation (CF Workers IP triggers SSO redirect on road.hycu.ac.kr). GET `/api/session` still validates by hitting Road API — may fail if Road is down.
9. **KV eventual consistency**: Dashboard state updates via KV are eventually consistent. Rapid successive writes may lose data.
10. **Rate limiting**: Workers attendance uses 500ms delay between submissions. Too aggressive and LMS may reject requests.
11. **Dashboard sync failures** (CLI): Sync is best-effort; network issues or invalid API key silently fail. Check console output for sync error messages.
12. **Dual constant maintenance**: URL constants and year/semester exist in both `src/config.ts` (CLI) and `web/src/lib/constants.ts` (Workers). Changes must be synchronized.
13. **GitHub Actions deploy**: Workflow at `.github/workflows/deploy.yml` requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. Token must have Pages:Edit + Workers Scripts:Edit + KV Storage:Edit permissions.
14. **api-attend vs attend**: `api-attend` is faster but relies on exact `saveStdyRecord.do` API parameters. If LMS changes the API, `attend` (Playwright) is the fallback since it uses real browser playback.
