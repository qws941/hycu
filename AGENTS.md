# HYCU — LMS Lecture Attendance Automation

Automates HYCU University LMS (`lms.hycu.ac.kr`) lecture attendance.
Runs as a **Docker container** on Synology NAS with scheduled attendance
(weekdays 17:00 KST) and CLI commands for manual operations.

## Quick Reference

| Item | Value |
|------|-------|
| Runtime | Node.js 22 + TypeScript 5.7 (strict, ES2022, ESM) |
| Browser | Playwright 1.50 (Chromium, persistent context) — login only |
| Container | Docker (node:22-slim) + docker-compose |
| Image | `ghcr.io/qws941/hycu:latest` |
| CI/CD | GitHub Actions → GHCR → Watchtower auto-pull |
| CLI Entry | `tsx src/index.ts <command>` |
| CLI Commands | `login`, `attend`, `api-attend`, `status`, `notices` |
| Scheduler | `scripts/scheduler.ts` — weekdays 17:00 KST |
| Build | `tsc` → `dist/` |
| Config | `.env` (dotenv) — credentials + FIDO keys |
| Session | `cookies/` dir — Playwright storage state (Docker volume) |

## Directory Map

```
hycu/
├── src/                        # Application source (9 files, flat)
│   ├── index.ts                # CLI entry — command router (login/attend/api-attend/status/notices)
│   ├── config.ts               # Environment loader, URL constants, FIDO config
│   ├── browser.ts              # Playwright context factory + cookie persistence
│   ├── login.ts                # FIDO/PIN SSO authentication flow
│   ├── attend.ts               # Course discovery + video attendance automation (legacy)
│   ├── api-attend.ts           # Pure API attendance (no Playwright, fetch-based)
│   ├── status.ts               # Course progress display (table output)
│   └── sync.ts                 # Dashboard sync — POSTs state to external API
│   ├── notices.ts              # Exam schedules + course announcements
├── scripts/                    # Operational scripts
│   ├── scheduler.ts            # Node.js timer — weekdays 17:00 KST → login + api-attend
│   ├── capture-sso-dom.ts      # SSO diagnostic: DOM capture
│   └── diagnose-sso*.ts        # SSO diagnostic: v1, v2, v3 iterations
├── .github/                    # CI/CD
│   └── workflows/
│       └── docker.yml          # GitHub Actions: build + push to GHCR
├── data/                       # Reference material (HAR captures, extracted JS)
│   ├── *.har                   # Network captures from LMS/SSO
│   └── *.js                    # Extracted site JS for reverse-engineering
├── cookies/                    # Playwright storage state (Docker volume, gitignored)
├── Dockerfile                  # node:22-slim + Playwright Chromium
├── docker-compose.yml          # scheduler + cli + watchtower services
├── .dockerignore               # Build context exclusions
├── .env                        # Credentials (HYCU_USER_ID, FIDO_*)
├── .env.example                # Environment variable template
├── tsconfig.json               # strict, ES2022, ESNext modules, bundler resolution
└── package.json                # build/start/login/attend/api-attend/status scripts
```

## Architecture

### Docker Services

```
┌──────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                          │
│  scheduler (always running)                              │
│    └── scripts/scheduler.ts                              │
│        ├── Timer: weekdays 17:00 KST                     │
│        ├── login.ts  → SSO FIDO auth → save cookies      │
│        └── api-attend.ts → Pure API attendance (~15s)     │
│                                                          │
│  cli (on-demand, profile: cli)                           │
│    └── tsx src/index.ts <cmd>                             │
│        ├── "login"      → SSO FIDO auth                  │
│        ├── "attend"     → Playwright video playback       │
│        ├── "api-attend" → Pure API attendance             │
│        └── "status"     → fetch + print table             │
│        ├── "notices"   → exam schedules + announcements   │
│                                                          │
│  watchtower (always running)                             │
│    └── Polls GHCR every 30s for new images               │
│        Auto-pulls + restarts scheduler                   │
│                                                          │
│  Volume: ./cookies → /app/cookies (shared)               │
└──────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
git push master → GitHub Actions (docker.yml)
  → docker build + push to ghcr.io/qws941/hycu:latest
  → Watchtower detects new image (30s poll)
  → Pulls image + restarts scheduler container
```

### Browser Lifecycle

Login creates a Playwright persistent browser context via `browser.ts`:
1. Launches Chromium with `cookies/` as `userDataDir`
2. Session state (cookies + localStorage) persists across runs via Docker volume
3. `login` must run first to establish session; `api-attend`/`status` read cookies directly

### External Services

| Service | Domain | Purpose |
|---------|--------|---------|
| LMS | `lms.hycu.ac.kr` | Main learning platform |
| Road | `road.hycu.ac.kr` | Course content delivery, token API |
| SSO | `sso.hycu.ac.kr` | SAML authentication |
| FIDO | `fido.hycu.ac.kr:28444` | FIDO key-based auth API |

## Module Details

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
- **LMS cookie refresh**: Visits `lms.hycu.ac.kr` after login (both fresh and already-logged-in paths) to establish LMS cookies.

### `attend.ts` — Lecture Attendance (legacy, ~495 lines)
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
6. **Speed**: ~33 minutes for 6 courses (real video playback)

### `api-attend.ts` — Pure API Attendance (primary, ~400 lines)
Submits attendance records via direct HTTP API calls without browser automation:

1. **Session**: Reads cookies from `cookies/session.json` (Playwright storage state format)
2. **Token**: Fetches auth token from road.hycu.ac.kr `/pot/MainCtr/findToken.do`
3. **Courses**: Gets enrolled courses from LMS API
4. **Lesson filtering**: Open weeks (lessonStartDt <= today, ltDetmToDtMax >= today) + not yet attended
5. **Attendance submission**: HAR-verified sequence per lesson:
   - `GET crsStdLessonView.do` — initializes server-side study session
   - `POST checkStdySchedule.do` — validates schedule
   - `POST saveStdyRecord.do` (Call 1) — initial record
   - 2s delay
   - `POST checkStdySchedule.do` — re-validate
   - `POST saveStdyRecord.do` (Call 2) — completion record
6. **Timing**: `studySessionTm` in **seconds** (`requiredMinutes * 60`), `requiredMinutes = Math.ceil(lbnTm * 0.55)`
7. **Format**: `playStartDttm` uses `HHMMSS` (no colons)
8. **Result**: `result=100` = attendance complete, `studyStatusCd=COMPLETE`
9. **Speed**: ~15 seconds total for 6 courses

### `status.ts` — Progress Display
- Fetches course list + completion data from road.hycu.ac.kr
- Renders progress table to stdout
- **Hardcoded values**: `YEAR="2026"`, `SEMESTER="10"` — must update for different terms

### `sync.ts` — Dashboard Sync
- Best-effort POST to `HYCU_DASHBOARD_URL/api/sync` after each CLI command
- Sends action type, success status, and course progress data
- 10-second timeout; failures are non-fatal (logged to console, never throws)

### `notices.ts` — Exam Schedules & Course Announcements
Fetches exam schedules, course notices, and academic calendar via LMS APIs:

1. **Exam list**: `POST road.hycu.ac.kr/pot/UserCtr/findAllExamList.do` (yy, tmGbn params)
2. **Course notices**: `POST lms.hycu.ac.kr/api/selectStuLessonNoticeList.do` (year, semester, userNo, alarmType=NOTICE, token)
3. **Academic schedule**: `POST api.hycu.ac.kr/uni/api/findSchaffScheList` (JSON: {userId, univGbn}) — wrapped in try/catch (non-JSON responses possible)
- Reads cookies from `cookies/session.json`, fetches token via Road API
- Outputs formatted tables to stdout

### `scripts/scheduler.ts` — Attendance Scheduler
- Node.js timer-based scheduler (no cron dependency)
- Schedule: weekdays 17:00 KST
- Each run: `login()` → `apiAttend()`
- `--now` flag: run immediately then schedule next
- Graceful shutdown on SIGTERM/SIGINT

## Docker

### Dockerfile
- Base: `node:22-slim`
- Installs npm deps + Playwright Chromium with system deps
- `VOLUME /app/cookies` for persistent session storage
- `ENTRYPOINT ["npx", "tsx", "src/index.ts"]` + `CMD ["api-attend"]`

### docker-compose.yml
Three services:
- **scheduler**: runs `scripts/scheduler.ts`, always-on, restarts unless-stopped
- **cli**: on-demand via `docker compose run --rm cli <command>`, profile `cli`
- **watchtower**: polls GHCR every 30s, auto-updates scheduler container, scope `hycu`

All services share `./cookies:/app/cookies` volume and `.env` file.

### CI/CD — `.github/workflows/docker.yml`
- Trigger: push to `master` (excluding `*.md`, `data/**`) + `workflow_dispatch`
- Steps: checkout → buildx → GHCR login → metadata (sha + latest tags) → build+push
- Auth: `GITHUB_TOKEN` (automatic, no extra secrets needed)
- Cache: GitHub Actions cache (`type=gha`)

## Environment Variables

### `.env`

| Variable | Purpose |
|----------|---------|
| `HYCU_USER_ID` | Student ID for SSO login |
| `HYCU_USER_NAME` | Student name |
| `FIDO_KEY_ID` | FIDO authentication key identifier |
| `FIDO_KEY_VALUE` | FIDO authentication key value |
| `FIDO_REG_DATA` | FIDO registration data blob |
| `FIDO_PIN` | FIDO PIN for authentication |
| `FIDO_KEYSTORE_JSON` | Full KeyStore JSON blob |
| `HYCU_DASHBOARD_URL` | Dashboard API base URL (optional) |
| `HYCU_API_KEY` | Bearer token for dashboard sync API (optional) |

## Common Tasks

### Run attendance (Docker)
```bash
# Scheduler runs automatically at 17:00 KST weekdays
docker compose up -d          # Start scheduler + watchtower

# Manual operations
docker compose run --rm cli login        # Establish SSO session
docker compose run --rm cli api-attend   # Run attendance now
docker compose run --rm cli status       # Check progress
```

### Run attendance (local, no Docker)
```bash
npm run login         # Establish SSO session
npm run api-attend    # Submit attendance via API (~15 seconds)
npm run status        # Check progress
```

### Deploy
Push to `master` → GitHub Actions builds Docker image → GHCR → Watchtower auto-pulls on NAS.

### Change semester
Update `YEAR` and `SEMESTER` constants in:
- `src/status.ts` (CLI)
- `src/api-attend.ts` (API attendance)

### Debug SSO issues
Use scripts in `scripts/` — they capture DOM state and diagnose SSO flow failures.

## Conventions

- **No subdirectories in `src/`** — flat module structure, each file = one responsibility
- **Console output**: Direct `console.log()` for CLI user feedback, no logging library
- **Error handling**: Try/catch at command level
- **No tests**: No test framework configured
- **No linting**: No ESLint/Prettier/Biome configured

## Pitfalls

1. **Session expiry**: Cookies expire server-side. If `api-attend` or `status` fail with SSO redirect, re-run `login`.
2. **FIDO key rotation**: If FIDO keys change on the server side, `.env` values must be updated manually.
3. **Hardcoded semester**: `src/status.ts` and `src/api-attend.ts` have hardcoded year/semester — must update for different terms.
4. **Playwright version**: FIDO auth flow depends on specific page structure; Playwright/Chromium upgrades may break selectors.
5. **Network timeouts**: SAML redirect chain uses 30s timeout; slow SSO server can cause false failures.
6. **Attendance parameters**: `saveStdyRecord.do` requires precise field set including `lbnTm`, `studyCnt`, `playStartDttm` (HHMMSS, no colons), `studySessionTm` (in seconds). Missing or malformed fields cause silent failures (HTTP 200 but no attendance recorded).
7. **Server-side session init**: `crsStdLessonView.do` GET must be called before `saveStdyRecord.do` — initializes server-side study session. Without it, server returns `result=-5`.
8. **studySessionTm units**: Value is in **seconds**, not minutes. `requiredMinutes * 60` where `requiredMinutes = Math.ceil(lbnTm * 0.55)`.
9. **Dual-call pattern**: HAR-verified — two sequential `saveStdyRecord.do` calls ~2s apart required for attendance recognition. Single call only saves record (`result=1`) without completing attendance.
10. **Docker cookie volume**: `./cookies` must be writable by container. Playwright writes `session.json` and browser state here.
11. **Watchtower scope**: Uses `com.centurylinklabs.watchtower.scope=hycu` label to only update HYCU containers, not other containers on the NAS.
12. **GHCR auth**: GitHub Actions uses `GITHUB_TOKEN` for GHCR push. Repository must have packages write permission enabled.
13. **api-attend vs attend**: `api-attend` is faster (~15s) but relies on exact `saveStdyRecord.do` API parameters. If LMS changes the API, `attend` (Playwright) is the fallback since it uses real browser playback.
14. **Dashboard sync failures**: Sync is best-effort; network issues or invalid API key silently fail. Check console output for sync error messages.
