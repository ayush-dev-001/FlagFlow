# FlagFlow

Multi-tenant feature flags: teams turn app features on or off for specific end users without redeploying.

- [PLAN.md](PLAN.md): decisions, API contract, build phases and the phase gate
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system diagrams, data model, Redis keys and security design

## Requirements

- Node 24 (see `.nvmrc`) and npm 11
- Docker Desktop (Postgres, Redis, Mailpit, and the gitleaks/semgrep scans)

## Quick start

```bash
npm install
npm run setup:env      # creates each app's .env from .env.example with generated secrets
docker compose up -d   # postgres :5432, redis :6379, mailpit :1025 (UI http://localhost:8025)
npm run dev            # api :4000, dashboard :5173, demo-api :4100, demo-web :5174
```

## Scripts

| Script              | What it does                                                          |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | Starts all four apps with live reload                                 |
| `npm test`          | Unit and integration tests (Vitest)                                   |
| `npm run verify`    | Typecheck, lint, format check, tests and build across every workspace |
| `npm run security`  | `npm audit`, gitleaks, semgrep and the attack suite in `security/`    |
| `npm run setup:env` | Creates missing `.env` files; never overwrites existing ones          |
| `npm run format`    | Formats the repo with Prettier                                        |

CI runs `npm run verify` on every push to `main` and on pull requests.

## Layout

```
apps/
  api/          FlagFlow API (Express)
  dashboard/    FlagFlow dashboard (React + Vite)
  demo-api/     Demo customer backend (uses flag-client)
  demo-web/     Demo customer frontend
packages/
  shared/       Shared types and evaluate()
  flag-client/  Node client: snapshot, SSE and local evaluation
security/       Attack suite and per-phase security reports
docker/         Container init scripts
```
