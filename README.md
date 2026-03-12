# HYCU LMS Automation

한양사이버대학교 (HYCU) 온라인 강의 출석 자동화 도구.

매 학기 강의 영상 출석을 자동으로 처리하고, 진행 상태를 조회하며, 공지사항을 확인합니다.

## Features

- **자동 출석** — LMS API를 통해 수강 중인 전 과목의 미수강 강의 일괄 출석 처리
- **진행 상태 조회** — 전체 과목 수강률·성적 현황 테이블 출력
- **공지사항 조회** — 과목별 공지 및 시험 일정 확인
- **자동 스케줄링** — n8n 워크플로우로 평일 17:00 KST 자동 실행, Slack 알림
- **세션 관리** — Playwright 기반 FIDO 인증 로그인, 쿠키 자동 갱신
- **에러 핸들링** — 세션 만료 자동 감지, 타입별 에러 분류, 재시도 로직
- **대시보드 연동** — 실행 결과를 외부 대시보드에 동기화 (best-effort)
- **HTTP API** — n8n 등 외부 오케스트레이터에서 호출 가능한 REST API 서버

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  n8n (Workflow Automation)                                   │
│  Schedule: weekdays 17:00 KST                               │
│  POST /api/run ──────────────────┐                          │
│  Retry on failure (60s)          │                          │
│  Slack notification (✅/❌)       │                          │
└──────────────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│  Synology NAS (Docker)                                      │
│                                                              │
│  hycu-server :8080                                           │
│    ├── /api/health    ← health check                        │
│    ├── /api/run       ← full cycle (login → attend → sync)  │
│    ├── /api/login     ← login only                          │
│    └── /api/attend    ← attend only                         │
│                                                              │
│  Internal flow:                                              │
│    1. login (Playwright + FIDO)                              │
│    2. api-attend (fetch, 2 retries)                          │
│    3. sync to dashboard (best-effort)                        │
└──────────────────────────────────────────────────────────────┘

git push master
  → GitHub Actions: typecheck → build Docker image → push GHCR
  → Watchtower auto-pulls new image → NAS restarts hycu-server
```

## Architecture

```
src/
├── index.ts              # CLI 엔트리포인트 (login, api-attend, status, notices, server)
├── config.ts             # 환경변수 로드 (.env), URL·경로 설정
├── server.ts             # HTTP API 서버 (node:http, API key 인증, mutex)
├── attendance-runner.ts  # 출석 실행 공유 로직 (login → attend → sync, 재시도)
├── login.ts              # Playwright FIDO/PIN SSO 인증 → 쿠키 저장
├── api-attend.ts         # API 기반 출석 처리 (과목 → 강의 → 출석 기록)
├── attend.ts             # Playwright 기반 출석 처리 (레거시 폴백)
├── status.ts             # API 기반 수강 진행 상태 조회
├── notices.ts            # 공지사항·시험 일정 조회
├── cookies.ts            # 쿠키 로드/파싱, 토큰 발급, 세션 유효성 검증
├── errors.ts             # 타입별 에러 (SessionExpiredError, CookieError, ApiError)
├── sync.ts               # 대시보드 동기화 (best-effort)
└── browser.ts            # Playwright 브라우저 컨텍스트 생성

scripts/
└── scheduler.ts          # 레거시 스케줄러 (평일 자동 실행, 하위 호환용)

n8n/
└── hycu-lms-attendance.json  # n8n 워크플로우 정의 (import용)
```

### Attendance API Sequence (per lesson)

```
GET  crsStdLessonView.do     ← init server session
POST checkStdySchedule.do    ← validate
POST saveStdyRecord.do       ← call 1 (start)
     ~2s delay
POST checkStdySchedule.do    ← re-validate
POST saveStdyRecord.do       ← call 2 (complete → result=100)
```

## CLI Commands

```bash
npx tsx src/index.ts login        # FIDO 인증 로그인
npx tsx src/index.ts api-attend   # API 출석 처리 (권장)
npx tsx src/index.ts attend       # Playwright 출석 (레거시)
npx tsx src/index.ts status       # 수강 상태 조회
npx tsx src/index.ts notices      # 공지사항·시험 일정
npx tsx src/index.ts server       # HTTP API 서버 시작 (:8080)
```

npm scripts: `npm run login`, `npm run api-attend`, `npm run status`, `npm run notices`, `npm run server`

## Error Handling

| Error Type | Exit | 원인 | 조치 |
|---|---|---|---|
| `SessionExpiredError` | 2 | 세션 만료, SSO 리다이렉트 | `login` 재실행 |
| `CookieError` | 2 | 쿠키 파일 없음·손상 | `login` 재실행 |
| `ApiError` | 3 | API 비정상 응답 | 로그 확인 |
| Unknown | 1 | 예상 외 에러 | 로그 확인 |

**세션 만료 감지**: API 응답이 200 OK이지만 HTML 반환 시, 또는 SSO 도메인으로 리다이렉트 시 `SessionExpiredError` 발생.

**서비스 재시도**: 일시적 에러는 최대 2회 재시도 (30초 간격). 세션/쿠키 에러는 재시도 스킵 (재로그인 필요). n8n에서 외부 재시도 1회 추가 (60초 후).

## Setup

### Environment Variables

```bash
cp .env.example .env
# Fill in credentials
```

| Variable | Required | Description |
|---|---|---|
| `HYCU_USER_ID` | Yes | SSO 로그인 ID |
| `HYCU_USER_NAME` | Yes | SSO 사용자 이름 |
| `FIDO_KEY_ID` | Yes | FIDO 인증 키 ID |
| `FIDO_ALG` | Yes | FIDO 알고리즘 (`ecdsa`) |
| `FIDO_PRIKEY` | Yes | FIDO 개인키 |
| `FIDO_FINGERPRINT` | Yes | FIDO 지문 |
| `FIDO_MULTI` | Yes | FIDO 다중 인증 (`y`) |
| `FIDO_TYPE` | Yes | FIDO 인증 타입 (`pin`) |
| `FIDO_PIN` | Yes | FIDO PIN |
| `FIDO_KEYSTORE_JSON` | Yes | FIDO KeyStore JSON |
| `HYCU_YEAR` | No | 학년도 (미지정 시 자동 감지) |
| `HYCU_SEMESTER` | No | 학기 코드: `10`=1학기, `20`=2학기 (자동 감지) |
| `HYCU_SERVICE_API_KEY` | No | HTTP API 인증 키 (미지정 시 인증 비활성화) |
| `PORT` | No | HTTP 서버 포트 (기본: `8080`) |
| `SCHEDULE_HOUR` | No | 레거시 스케줄러 실행 시각 (기본: `17`) |
| `SCHEDULE_MINUTE` | No | 레거시 스케줄러 실행 분 (기본: `0`) |
| `HYCU_DASHBOARD_URL` | No | 대시보드 동기화 URL |
| `HYCU_API_KEY` | No | 대시보드 API 키 |

### Docker (recommended)

```bash
docker compose up -d          # Start server + watchtower

# Manual operations
docker compose run --rm cli login        # SSO 로그인
docker compose run --rm cli api-attend   # 출석 실행
docker compose run --rm cli status       # 상태 확인
docker compose run --rm cli notices      # 공지 확인
```

### Local Development

```bash
npm install
npx playwright install --with-deps chromium
npm run login
npm run api-attend
```

## CI/CD

Push to `master` triggers `.github/workflows/docker.yml`:

| Job | Trigger | Action |
|-----|---------|--------|
| `typecheck` | push + PR | `npm ci && tsc --noEmit` |
| `build-and-push` | master push | Docker buildx → `ghcr.io/qws941/hycu:latest` |

**Deployment**: Watchtower on NAS polls GHCR every 5 minutes and auto-pulls new images.

## n8n Integration

스케줄링은 n8n 워크플로우로 관리됩니다.

### Workflow: HYCU LMS Attendance

- **Schedule**: 평일 17:00 KST (cron `0 8 * * 1-5` UTC)
- **Flow**: HTTP POST `/api/run` → 성공 시 Slack ✅ / 실패 시 60초 후 재시도 → 최종 실패 Slack ❌
- **Slack**: `#hycu-attendance` 채널 알림 (channel ID: `C0AGRJ1QHJ6`)

### n8n 환경변수

| Variable | Description |
|---|---|
| `HYCU_SERVICE_URL` | HYCU HTTP 서비스 URL (예: `http://192.168.50.xxx:8080`) |
| `HYCU_SERVICE_API_KEY` | `.env`의 `HYCU_SERVICE_API_KEY`와 동일한 값 |

### HTTP API

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | No | 서비스 상태 확인 |
| `/api/run` | POST | API Key | 전체 사이클 (로그인 → 출석 → 동기화) |
| `/api/login` | POST | API Key | 로그인만 실행 |
| `/api/attend` | POST | API Key | 출석만 실행 |

**인증**: `x-api-key` 헤더에 API 키 전달. `HYCU_SERVICE_API_KEY` 미설정 시 인증 비활성화.

**응답 형식**:
```json
{
  "success": true,
  "data": { "message": "...", "attempts": 1 },
  "duration": 12345
}
```

### Rollback (Legacy Scheduler)

서버 장애 시 레거시 스케줄러로 복구:

```bash
# 1. n8n 워크플로우 비활성화 (중복 실행 방지)
# 2. docker-compose.yml 수정: server 서비스 주석 처리 후 scheduler 추가
#   scheduler:
#     image: ghcr.io/qws941/hycu:latest
#     container_name: hycu-scheduler
#     restart: unless-stopped
#     env_file: .env
#     volumes:
#       - ./cookies:/app/cookies
#     environment:
#       TZ: Asia/Seoul
#     entrypoint: ["npx", "tsx", "scripts/scheduler.ts"]
#     labels:
#       - com.centurylinklabs.watchtower.scope=hycu
# 3. 재배포
docker compose down
docker compose up -d
```

## Semester Config

학기 정보는 `config.ts`에서 자동 감지:
- 3~8월 → 현재 연도, 1학기 (`10`)
- 9~12월 → 현재 연도, 2학기 (`20`)
- 1~2월 → 전년도, 2학기 (`20`)

환경변수 `HYCU_YEAR`, `HYCU_SEMESTER`로 수동 오버라이드 가능.

## Tech Stack

- Node.js 22 + TypeScript 5.7 (ESM, strict)
- Playwright (Chromium — login only)
- Docker (`node:22-slim`) + Watchtower
- n8n (workflow automation, scheduling, Slack notification)
- GitHub Actions → GHCR
## License

MIT
