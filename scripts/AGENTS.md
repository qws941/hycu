# PROJECT KNOWLEDGE BASE

## OVERVIEW

`scripts/` contains operational helpers outside the main CLI: the weekday scheduler plus one-off Playwright diagnostics used to reverse-engineer HYCU SSO and course pages.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Production-like scheduled runs | `scripts/scheduler.ts` | Calls `login()` then `apiAttend()`, retries non-session failures |
| Course-home inspection | `scripts/debug-course-home.ts` | Loads `cookies/session.json`, dumps `LESSON_SCHEDULE_LIST` |
| SSO DOM capture | `scripts/capture-sso-dom.ts` | Writes `sso-dom.html`, `sso-forms.json`, screenshots |
| Early SSO diagnostics | `scripts/diagnose-sso.ts` | Cookie/localStorage/MagicSA probing |
| Focused PIN-flow check | `scripts/diagnose-sso-v2.ts` | Manual form activation + network logging |
| MagicSA storage reverse-engineering | `scripts/diagnose-sso-v3.ts` | `setKeyStore()` experiments and deeper internals |

## CONVENTIONS

- Scripts import shared runtime config from `../src/config.js` when credentials or URLs are needed.
- Diagnostic scripts are intentionally verbose and artifact-heavy; writing screenshots or HTML files to repo root is normal here.
- Most diagnostic flows run headed Chromium (`headless: false`) because the goal is inspection, not unattended automation.
- `scripts/scheduler.ts` is the only script that behaves like supported automation; the rest are investigation tools.

## ANTI-PATTERNS

- Do not promote ad-hoc diagnostic scripts into `src/` unless they become supported product behavior.
- Do not hardcode secrets or commit live credentials while iterating on diagnostics.
- Do not assume script output files are clean build artifacts; many are for local forensic use only.
- Do not bypass `src/` helpers in scheduler code when shared logic already exists.

## NOTES

- `scripts/scheduler.ts` skips retries for `SessionExpiredError` and `CookieError`, but retries other failures up to two times.
- Diagnostic scripts currently emit files like `diag-*.png`, `sso-dom*.html`, and `sso-forms.json` at repo root.
- `debug-course-home.ts` uses a fixed course code and is for manual introspection, not general-purpose automation.
