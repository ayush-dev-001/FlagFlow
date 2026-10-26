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
npm run db:migrate     # applies Prisma migrations to the dev database
npm run db:seed        # superadmin, the "acme" demo org with its admin, and six demo flags (safe to re-run)
npm run dev            # api :4000, dashboard :5173, demo-api :4100, demo-web :5174
```

## The live demo

The demo customer app shows a flag change landing in a running app with no refresh and no redeploy.

1. With the API running, give the demo backend a key for the seeded Acme org. `npm run demo:key` creates it and saves it to `apps/demo-api/.env`. Then restart `npm run dev`.
2. Open the demo at http://localhost:5174 and the dashboard at http://localhost:5173, side by side. Log in to the dashboard as the demo admin; the credentials are in `apps/api/.env`.
3. Pick a user in the demo panel (U001–U005) and change any of the six flags in the dashboard. The Acme app changes within a second for the users the flag reaches, and the panel logs each change.

| Flag                  | On                   | Off                 |
| --------------------- | -------------------- | ------------------- |
| `dark_mode`           | Dark theme           | Light theme         |
| `chat_widget`         | Support chat bubble  | Hidden              |
| `analytics_dashboard` | Sales analytics      | Locked              |
| `new_checkout`        | One-step checkout    | Classic three steps |
| `beta_banner`         | Beta banner          | None                |
| `export_report`       | Export PDF on Orders | Hidden              |

`demo-api` holds the API key and evaluates flags locally with `flag-client`, so the browser never sees the key. It also enforces the same flags on its own routes.

## Deployment

The live demo runs on Render (API, dashboard and demo backend) and Vercel (demo app). [DEPLOY.md](DEPLOY.md) has the steps.

## API contract and tests

The OpenAPI spec lives at `postman/specs/flagflow-api.openapi.json`. The API also serves it at `/api/docs`; refresh the file with `npm run openapi`. A test fails if the file drifts from the code.

The `postman/collections/` folder holds three collections:

- **FlagFlow API:** a reference collection generated from the spec.
- **FlagFlow Smoke:** a scripted end-to-end contract check (`npm run postman:smoke`).
- **FlagFlow Load:** a load test for `/v1/flags/evaluate`, run with `node scripts/load-test.mjs`.

## Scripts

| Script               | What it does                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| `npm run dev`        | Starts all four apps with live reload                                       |
| `npm test`           | Unit and integration tests (Vitest)                                         |
| `npm run verify`     | Typecheck, lint, format check, tests and build across every workspace       |
| `npm run security`   | `npm audit`, gitleaks, semgrep and the attack suite in `security/`          |
| `npm run setup:env`  | Creates missing `.env` files and adds missing keys; never overwrites values |
| `npm run db:migrate` | Creates and applies Prisma migrations (dev database)                        |
| `npm run db:seed`    | Seeds the dev database; only creates what is missing                        |
| `npm run demo:key`   | Creates an API key for the demo org and saves it to `apps/demo-api/.env`    |
| `npm run e2e`        | Playwright journeys at 1440px and 375px, including the live demo            |
| `npm run format`     | Formats the repo with Prettier                                              |

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
