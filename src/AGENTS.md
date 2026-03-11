# PROJECT KNOWLEDGE BASE

## OVERVIEW

`src/` is the maintained runtime: CLI dispatch, login/session setup, fetch-based LMS operations, typed errors, and optional dashboard sync.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Command routing and exit codes | `src/index.ts` | Default command is `status`; maps typed errors to process exit codes |
| Required env and semester defaults | `src/config.ts` | `dotenv/config`, HYCU URLs, `cookies/session.json`, dashboard URL |
| Browser context and cookie persistence | `src/browser.ts` | Headless Chromium, locale/timezone, cookie restore/save |
| FIDO/PIN login | `src/login.ts` | Injects keyStore into localStorage, calls `fnDefaultPinLoginForm()` / `fnLoginPin()` |
| Shared cookie/token helpers | `src/cookies.ts` | Cookie parsing, `findToken.do`, session redirect and HTML-body guards |
| Primary attendance path | `src/api-attend.ts` | HAR-verified dual-save attendance sequence |
| Legacy fallback attendance | `src/attend.ts` | Browser-heavy fallback; avoid copying its patterns blindly |
| Progress reporting | `src/status.ts` | Fetch-only course progress table |
| Notices and academic calendar | `src/notices.ts` | Pulls three endpoints in parallel |
| Non-fatal dashboard reporting | `src/sync.ts` | `POST /api/sync`, timeout 10s, logs and returns on failure |

## CONVENTIONS

- Keep `config` as the only source of env-derived runtime settings; most modules cache `config.urls` and `config.semester` locally.
- Use typed failures from `src/errors.ts` rather than ad-hoc string matching.
- API modules rely on `loadCookieHeaders()`, `fetchToken()`, and `parseJsonResponse()` instead of duplicating session checks.
- Session expiry means redirect-to-SSO or HTML body, not just non-200 status.
- `syncToDashboard()` is post-action reporting only; command success must not depend on it.
- Playwright belongs in `login.ts`, `browser.ts`, and legacy/debug flows, not in new fetch-capable features.

## ANTI-PATTERNS

- Do not duplicate cookie parsing or token fetch logic outside `src/cookies.ts`.
- Do not introduce raw `process.exit()` calls outside entrypoint-like orchestration without a strong reason.
- Do not model new flows on `src/attend.ts` hardcoded semester constants; use `config.semester`.
- Do not swallow session failures as generic errors; preserve `SessionExpiredError` and `CookieError` boundaries.
- Do not make dashboard sync fatal.

## NOTES

- `src/attend.ts` is larger, older, and less aligned with current API-first design than `src/api-attend.ts`.
- `src/login.ts` relies on upstream page globals (`fnDefaultPinLoginForm`, `fnLoginPin`) exposed by HYCU SSO scripts.
- `src/browser.ts` restores any existing cookie file opportunistically; malformed state logs and starts fresh.
