# PROJECT KNOWLEDGE BASE

## OVERVIEW

`cloudflare/` is the Cloudflare Containers entrypoint layer: it boots the Worker-side container binding, proxies HTTP traffic to the service image, and triggers weekday attendance runs through the protected service API.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Worker fetch + cron orchestration | `cloudflare/worker.js` | Defines `HycuContainer`, forwards `fetch()`, and posts scheduled attendance requests |
| Worker/container config | `wrangler.jsonc` | Declares cron, container image, durable object binding, and default vars |
| Service endpoints behind the Worker | `src/service-server.ts` | Exposes `/healthz`, `/status`, `/notices`, `/api-attend` with API-key auth |
| Cloudflare service image | `Dockerfile.cloudflare` | Typechecks in build stage, installs Chromium, runs `src/service-server.ts` |
| Deployment commands and secrets | `README.md` | Documents `npm run cf:dev`, `npm run cf:deploy`, and required Worker secrets |

## CONVENTIONS

- Keep `cloudflare/worker.js` thin: container bootstrap, request proxying, and cron-trigger wiring only.
- Scheduled attendance always goes through protected `POST /api-attend` with `HYCU_SERVICE_API_KEY`; the Worker does not bypass service auth.
- Container instances are version-scoped via `HYCU_RUNTIME_VERSION`, so rollout boundaries belong in env/config, not hardcoded route logic.
- Cloudflare runtime uses ephemeral cookie storage (`HYCU_COOKIE_DIR=/tmp/hycu-cookies`) and depends on `src/service-server.ts` auto-login recovery instead of a public login endpoint.

## ANTI-PATTERNS

- Do not duplicate attendance, notice, or status business logic in `cloudflare/worker.js`; keep behavior in `src/service-server.ts` and shared `src/` modules.
- Do not add unauthenticated operational endpoints beyond health checks; `/status`, `/notices`, and `/api-attend` stay behind API-key auth.
- Do not assume NAS-style persistent volumes or mounted `./cookies`; Cloudflare runtime is intentionally ephemeral.
- Do not change cron request headers, route names, or container binding names without updating the matching auth/config contract in `wrangler.jsonc` and `src/service-server.ts`.

## NOTES

- `HycuContainer` listens on port `8080`, sleeps after `20m`, and injects HYCU/FIDO secrets into the container environment.
- `wrangler.jsonc` currently schedules attendance on weekdays at `0 8 * * 1-5` UTC, which the README documents as `17:00 KST`.
- The durable object binding name is `HYCU_CONTAINER`, and the current container cap is `max_instances: 2`.
