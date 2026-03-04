# HYCU LMS Attendance Automation

Automates lecture attendance for HYCU University LMS (`lms.hycu.ac.kr`).

Runs as a Docker container on Synology NAS — logs in via FIDO/PIN SSO, then submits attendance records through direct API calls (~15 seconds for all courses, no video playback required).

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  Synology NAS (Docker)                              │
│                                                     │
│  scheduler ─── weekdays 08:50 KST ──┐              │
│                                      ▼              │
│                              1. login (Playwright)  │
│                              2. api-attend (fetch)  │
│                                                     │
│  watchtower ── polls GHCR every 30s ──► auto-update │
└─────────────────────────────────────────────────────┘

git push master
  → GitHub Actions builds Docker image
  → Pushes to ghcr.io/qws941/hycu:latest
  → Watchtower detects + pulls + restarts
```

## Setup

### 1. Environment

```bash
cp .env.example .env
# Fill in credentials
```

| Variable | Required | Description |
|----------|----------|-------------|
| `HYCU_USER_ID` | Yes | Student ID |
| `HYCU_USER_NAME` | Yes | Student name |
| `FIDO_KEY_ID` | Yes | FIDO key identifier |
| `FIDO_PRIKEY` | Yes | FIDO private key |
| `FIDO_FINGERPRINT` | Yes | FIDO key fingerprint |
| `FIDO_PIN` | Yes | FIDO PIN |
| `FIDO_KEYSTORE_JSON` | Yes | Full KeyStore JSON blob |
| `HYCU_DASHBOARD_URL` | No | Dashboard API URL for sync |
| `HYCU_API_KEY` | No | Dashboard API bearer token |

### 2. Docker (recommended)

```bash
docker compose up -d          # Start scheduler + watchtower

# Manual operations
docker compose run --rm cli login        # Establish SSO session
docker compose run --rm cli api-attend   # Run attendance now
docker compose run --rm cli status       # Check progress
```

### 3. Local (no Docker)

```bash
npm install
npx playwright install chromium
npm run login
npm run api-attend
npm run status
```

## Architecture

| Component | Purpose |
|-----------|---------|
| `src/login.ts` | Playwright FIDO/PIN SSO authentication |
| `src/api-attend.ts` | Pure API attendance — HAR-verified dual-call to `saveStdyRecord.do` |
| `src/attend.ts` | Legacy Playwright video playback (~33 min, fallback) |
| `src/status.ts` | Course progress table |
| `scripts/scheduler.ts` | Node.js timer — weekdays 08:50 KST |

### Attendance API Sequence (per lesson)

```
GET  crsStdLessonView.do     ← init server session
POST checkStdySchedule.do    ← validate
POST saveStdyRecord.do       ← call 1 (start)
     ~2s delay
POST checkStdySchedule.do    ← re-validate
POST saveStdyRecord.do       ← call 2 (complete → result=100)
```

## CI/CD

Push to `master` triggers GitHub Actions (`.github/workflows/docker.yml`):
1. Build Docker image (`node:22-slim` + Playwright Chromium)
2. Push to `ghcr.io/qws941/hycu:latest`
3. Watchtower on NAS auto-pulls and restarts

## Semester Config

Update year/semester in:
- `src/status.ts`
- `src/api-attend.ts`

## Tech Stack

- Node.js 22 + TypeScript 5.7 (ESM, strict)
- Playwright 1.50 (Chromium, login only)
- Docker (node:22-slim) + Watchtower
- GitHub Actions → GHCR

## License

MIT
