# HYCU LMS Automation

한양사이버대학교 (HYCU) 온라인 강의 출석 자동화 도구.

매 학기 강의 영상 출석을 자동으로 처리하고, 진행 상태를 조회하며, 공지사항을 확인합니다.

## Features

- **자동 출석** — LMS API를 통해 수강 중인 전 과목의 미수강 강의 일괄 출석 처리
- **진행 상태 조회** — 전체 과목 수강률·성적 현황 테이블 출력
- **공지사항 조회** — 과목별 공지 및 시험 일정 확인
- **자동 스케줄링** — 평일 17:00 KST 자동 실행 (Docker 스케줄러)
- **세션 관리** — Playwright 기반 FIDO 인증 로그인, 쿠키 자동 갱신
- **에러 핸들링** — 세션 만료 자동 감지, 타입별 에러 분류, 재시도 로직
- **대시보드 연동** — 실행 결과를 외부 대시보드에 동기화 (best-effort)

## How It Works

```
┌─────────────────────────────────────────────────────┐
│  Synology NAS (Docker)                              │
│                                                     │
│  scheduler ─── weekdays 17:00 KST ──┐              │
│                                      ▼              │
│                              1. login (Playwright)  │
│                              2. api-attend (fetch)  │
│                                                     │
│  watchtower ── polls GHCR every 5m ───► auto-update │
└─────────────────────────────────────────────────────┘

git push master
  → GitHub Actions builds Docker image
  → Pushes to ghcr.io/qws941/hycu:latest
  → Watchtower detects + pulls + restarts
```

## Architecture

```
src/
├── index.ts        # CLI 엔트리포인트, 에러 분류 및 exit code 결정
├── config.ts       # 환경변수 로드 (.env), URL·경로 설정
├── login.ts        # Playwright FIDO/PIN SSO 인증 → 쿠키 저장
├── api-attend.ts   # API 기반 출석 처리 (과목 → 강의 → 출석 기록)
├── attend.ts       # Playwright 기반 출석 처리 (레거시 폴백)
├── status.ts       # API 기반 수강 진행 상태 조회
├── notices.ts      # 공지사항·시험 일정 조회
├── cookies.ts      # 쿠키 로드/파싱, 토큰 발급, 세션 유효성 검증
├── errors.ts       # 타입별 에러 (SessionExpiredError, CookieError, ApiError)
├── sync.ts         # 대시보드 동기화 (best-effort)
└── browser.ts      # Playwright 브라우저 컨텍스트 생성

scripts/
└── scheduler.ts    # 평일 17:00 KST 자동 실행, 재시도 (2회, 30초 간격)
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
```

npm scripts: `npm run login`, `npm run api-attend`, `npm run status`, `npm run notices`

## Error Handling

| Error Type | Exit | 원인 | 조치 |
|---|---|---|---|
| `SessionExpiredError` | 2 | 세션 만료, SSO 리다이렉트 | `login` 재실행 |
| `CookieError` | 2 | 쿠키 파일 없음·손상 | `login` 재실행 |
| `ApiError` | 3 | API 비정상 응답 | 로그 확인 |
| Unknown | 1 | 예상 외 에러 | 로그 확인 |

**세션 만료 감지**: API 응답이 200 OK이지만 HTML 반환 시, 또는 SSO 도메인으로 리다이렉트 시 `SessionExpiredError` 발생.

**스케줄러 재시도**: 일시적 에러는 최대 2회 재시도 (30초 간격). 세션/쿠키 에러는 재시도 스킵 (재로그인 필요).

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
| `SCHEDULE_HOUR` | No | 스케줄러 실행 시각 (기본: `17`) |
| `SCHEDULE_MINUTE` | No | 스케줄러 실행 분 (기본: `0`) |
| `HYCU_DASHBOARD_URL` | No | 대시보드 동기화 URL |
| `HYCU_API_KEY` | No | 대시보드 API 키 |

### Docker (recommended)

```bash
docker compose up -d          # Start scheduler + watchtower

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
1. Build Docker image (`node:22-slim` + Playwright Chromium)
2. Push to `ghcr.io/qws941/hycu:latest`
3. Watchtower on Synology NAS auto-pulls and restarts containers

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
- GitHub Actions → GHCR

## License

MIT
