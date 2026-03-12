# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-12
**Branch:** `master`

## OVERVIEW

HYCU LMS automation CLI for login, attendance, status, and notice retrieval. Runtime is Node.js + TypeScript; login uses Playwright/FIDO, day-to-day attendance and reporting use direct HYCU APIs. Deployment targets Synology NAS via Docker (scheduler + watchtower auto-update).

## STRUCTURE

```text
./
├── src/                  # main CLI runtime: login, API attendance, cookies, notices, status
├── scripts/              # scheduler plus headed Playwright diagnostics for SSO/course debugging
├── data/                 # captured vendor JS + HAR files used to reverse-engineer HYCU flows
├── cookies/              # runtime browser state; session.json is persisted here
├── .github/workflows/    # mostly synced governance workflows + one local Docker build pipeline
├── Dockerfile            # container image for CLI and scheduler
├── docker-compose.yml    # scheduler, manual CLI profile, watchtower updater
├── .env.example          # required FIDO/HYCU env contract
└── README.md             # architecture, commands, deployment notes
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| CLI command routing | `src/index.ts` | Dispatches `login`, `api-attend`, `attend`, `status`, `notices` |
| Env, URLs, semester, paths | `src/config.ts` | Auto-detects semester; cookie path is `cookies/session.json` |
| FIDO login flow | `src/login.ts` | Injects keyStore into localStorage, calls page JS directly |
| API attendance | `src/api-attend.ts` | Fast path; HAR-verified dual-call `saveStdyRecord.do` flow |
| Shared cookie/session guards | `src/cookies.ts` | Cookie loading, token fetch, redirect/HTML expiry detection |
| Shared LMS API types & fetchers | `src/lms-api.ts` | CourseInfo, LessonSchedule, CourseProgress; shared by status and api-attend |
| KST date helpers | `src/date.ts` | getTodayKst, normalizeDate, classifyLesson (overdue/pending/attended) |
| Typed failures | `src/errors.ts` | `SessionExpiredError`, `CookieError`, `ApiError` |
| Legacy Playwright attendance | `src/attend.ts` | Fallback path; larger and less trustworthy than API flow |
| Dashboard sync | `src/sync.ts` | Best-effort, non-fatal post-run reporting |
| Scheduled execution | `scripts/scheduler.ts` | Weekday runner, retry policy, dashboard failure sync |
| SSO reverse-engineering | `scripts/diagnose-sso*.ts`, `scripts/capture-sso-dom.ts` | Headed diagnostics, screenshots, DOM dumps |
| Docker CI/CD | `.github/workflows/docker.yml` | Local workflow; builds and pushes GHCR image |
| Deployment/runtime | `Dockerfile`, `docker-compose.yml` | CLI container, scheduler, watchtower auto-update |
| Reverse-engineered site assets | `data/` | External HYCU JS/HAR captures; not normal app source |

## CODE MAP

| Symbol / File | Role |
|---------------|------|
| `main()` in `src/index.ts` | CLI entrypoint, command dispatch, exit-code mapping |
| `config` in `src/config.ts` | Single source for env vars, URLs, semester, scheduler, dashboard, cookie paths |
| `login()` in `src/login.ts` | Playwright SSO + FIDO/PIN login, LMS cookie establishment |
| `apiAttend()` in `src/api-attend.ts` | Primary attendance engine via direct LMS HTTP calls |
| `fetchCourses()` / `fetchLessonSchedules()` in `src/lms-api.ts` | Shared LMS data fetchers for course list and per-lesson schedules |
| `getTodayKst()` / `classifyLesson()` in `src/date.ts` | KST date resolution and lesson state classification |
| `status()` in `src/status.ts` | Fetch-based course progress reporting |
| `notices()` in `src/notices.ts` | Exams, notices, academic calendar aggregation |
| `loadCookieHeaders()` / `fetchToken()` in `src/cookies.ts` | Shared session bootstrap for API modules |
| `syncToDashboard()` in `src/sync.ts` | Best-effort external status sync |
| `runAttendance()` / `scheduleNext()` in `scripts/scheduler.ts` | Long-running weekday automation loop |

## CONVENTIONS

- `src/` code is ESM TypeScript with strict mode and `tsx` execution; `build` is plain `tsc`.
- Login is the only supported production Playwright flow; status/notices/api-attend should stay fetch-first.
- Session expiry is detected by redirected URLs or HTML bodies, not by clean 401 responses.
- Cookie persistence lives in `cookies/session.json`; runtime cache under `cookies/Default/` is disposable noise.
- Dashboard sync is best-effort everywhere; failures log and return instead of aborting command success.
- Most workflow files under `.github/workflows/` are thin synced callers to `qws941/.github`; `docker.yml` is the local exception.

## ANTI-PATTERNS (THIS PROJECT)

- Do not treat `cookies/` as maintained source; never document cache internals as repo structure.
- Do not edit `data/*.js` as if they were application modules; they are captured upstream artifacts for analysis.
- Do not assume HYCU auth failures show up as normal HTTP auth errors; keep redirect/HTML guards intact.
- Do not make dashboard sync mandatory; it is intentionally non-blocking.
- Do not hand-edit synced workflow callers unless the source-of-truth change belongs in `qws941/.github`.

## UNIQUE STYLES

- Production automation is split: Playwright for login/session establishment, fetch for course APIs.
- Deployment is NAS/Docker only: scheduler runs as a long-lived container, watchtower handles auto-updates from GHCR.
- SSO debugging is heavily artifact-driven: screenshots, DOM snapshots, JSON summaries, and captured site JS/HAR files live in-repo.
- Korean operator-facing logs and comments are normal in runtime code; keep command output understandable for local manual use.
- Watchtower-based deployment means `git push master` is part of the operational path, not just source control.

## COMMANDS

```bash
npm install
npx playwright install --with-deps chromium
npm run build

npm run login
npm run api-attend
npm run status
npm run notices

npx tsx scripts/scheduler.ts --now
docker compose up -d
docker compose run --rm cli api-attend
```

## NOTES

- `docker-compose.yml` mounts `./cookies:/app/cookies`, so local session state is part of the deployment contract.
- `Dockerfile` typechecks in the build stage, then runs `tsx` directly in the runtime image.
- Root screenshots and `sso-dom*.html/json` files come from manual diagnostics in `scripts/`; they are investigation artifacts, not packaged assets.
