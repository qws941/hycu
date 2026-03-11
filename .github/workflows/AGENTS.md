# PROJECT KNOWLEDGE BASE

## OVERVIEW

`.github/workflows/` is mostly synced governance automation from `qws941/.github`, plus one local workflow for building and publishing the HYCU Docker image.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Local CI/CD for this repo | `.github/workflows/docker.yml` | Builds, typechecks, and pushes `ghcr.io/qws941/hycu` |
| Synced auto-merge | `.github/workflows/auto-merge.yml` | Thin caller to `qws941/.github` template |
| Synced release notes | `.github/workflows/release-drafter.yml` | Thin caller to shared template |
| Synced stale cleanup | `.github/workflows/stale.yml` | Thin caller with local trigger config only |
| Other governance/codex workflows | sibling `*.yml` files | Treat as synced callers unless proven otherwise |

## CONVENTIONS

- Files with `# SSoT: qws941/.github` comments are synced thin callers; the local copy mainly declares triggers, permissions, and `uses:`.
- `docker.yml` is the substantive local workflow: checkout, setup-node, typecheck, docker metadata, buildx, and GHCR push.
- `docker.yml` ignores `*.md` and `data/**` on push, so reverse-engineering artifacts do not trigger image builds.

## ANTI-PATTERNS

- Do not make repo-specific logic changes in synced caller workflows unless the source-of-truth repo is updated too.
- Do not treat every workflow here as independently authored; most are wrappers around shared templates.
- Do not remove the typecheck step from `docker.yml`; it is the only automated verification wired into the image pipeline.
- Do not let `docker.yml` assumptions leak into synced workflows.

## NOTES

- The local image path is `${{ github.repository }}` on `ghcr.io`, tagged by SHA and `latest`.
- Current `docker.yml` still uses mutable action tags (`@v4`, `@v5`, `@v6`); if this workflow is touched, align it with the repo's pinned-action policy in the same change.
