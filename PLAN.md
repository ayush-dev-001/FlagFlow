# FlagFlow — Build Plan

FlagFlow is a multi-tenant SaaS for feature flags: teams turn app features ON/OFF for specific end users **without redeploying**. Diagrams, data model, Redis keys and the security design live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). This file covers decisions, the API contract, the build phases and the quality gate each phase must pass.

---

## 1. Decisions (locked)

| Area | Choice |
|---|---|
| Language | TypeScript everywhere (strict mode) |
| Frontend | React 19 + Vite, Tailwind CSS, TanStack Query, React Router, Motion for animation |
| Backend | Node 24 + Express 5, zod validation, pino logging |
| Database | PostgreSQL 16 via Prisma (migrations committed) |
| Redis | ioredis — flag snapshot cache, pub/sub for live updates (SSE), rate limiting, sessions + token denylist |
| Repo | npm workspaces monorepo: `apps/api`, `apps/dashboard`, `apps/demo-api`, `apps/demo-web`, `packages/shared`, `packages/flag-client` |
| Local infra | `docker compose`: postgres, redis, mailpit |
| Tests | Vitest + Supertest (API, against the docker Postgres/Redis test DBs), Playwright (end-to-end), linkinator (broken links) |
| Git | Push to `main` after each phase passes its gate; commits authored by the repo owner only |

Product rules:
- Members join only by email invite (48h expiry). Only org creators sign up freely. One user belongs to one org.
- Flags default to OFF and may be created before the feature exists in code.
- Target users are end-user **ID strings** (`U001`), not dashboard accounts. A flag targets either a list of IDs or all users.
- Unknown flag / unknown user / any error ⇒ `false`.
- API keys are stored as SHA-256 hashes, shown once, revocable; an org may hold several keys so it can rotate without downtime.

## 2. API contract

Dashboard API base: `/api` (JWT). Public API base: `/v1` (API key). JSON everywhere. Errors use one shape: `{ error: { code, message, details? } }`. An OpenAPI 3.1 spec is generated from the zod schemas and served at `/api/docs`.

### Auth — public
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | name, email, password, organizationName → org + admin + first API key (shown once) |
| POST | `/api/auth/login` | → access token + refresh cookie |
| POST | `/api/auth/refresh` | rotates refresh cookie, returns new access token |
| POST | `/api/auth/logout` | revokes session, denylists access token |
| GET | `/api/auth/invites/:token` | invite preview |
| POST | `/api/auth/invites/:token/accept` | name, password |
| GET | `/api/auth/me` | JWT — current user + org |

### Team — JWT
| Method | Path | Role |
|---|---|---|
| GET | `/api/team/members` | any |
| PATCH | `/api/team/members/:id` | admin — `{ role }` or `{ isActive }`; the last admin can't be demoted or deactivated |
| POST | `/api/team/invites` | admin — `{ email, role }` |
| GET | `/api/team/invites` | admin |
| DELETE | `/api/team/invites/:id` | admin |

### Flags — JWT
| Method | Path | Role |
|---|---|---|
| GET | `/api/flags?search=&state=` | any |
| POST | `/api/flags` | any — key, description, targetAll, targets[] |
| GET | `/api/flags/:id` | any |
| PATCH | `/api/flags/:id` | any — description, targetAll |
| POST | `/api/flags/:id/toggle` | any |
| POST | `/api/flags/:id/targets` | any — `{ add?: [], remove?: [] }` |
| DELETE | `/api/flags/:id` | admin |
| GET | `/api/end-users/:endUserId/flags` | any — every flag with `enabled` + `targeted` for that user |
| GET | `/api/audit-logs?flagId=&actorId=&cursor=` | admin |

### Organization — JWT, admin
| Method | Path | Notes |
|---|---|---|
| GET | `/api/org` | name, slug |
| PATCH | `/api/org` | name |
| GET | `/api/org/api-keys` | prefix, name, lastUsedAt, revokedAt |
| POST | `/api/org/api-keys` | `{ name }` → full key, shown once |
| DELETE | `/api/org/api-keys/:id` | revoke |

### Superadmin — JWT, superadmin
| Method | Path |
|---|---|
| GET | `/api/admin/organizations` |
| PATCH | `/api/admin/organizations/:id` — `{ isActive }` |

### Public — `x-api-key`
| Method | Path | Result |
|---|---|---|
| GET | `/v1/flags/evaluate?userId=U001` | `{ version, flags: { dark_mode: true, … } }` (every org flag) |
| GET | `/v1/flags/:key/evaluate?userId=U001` | `{ version, enabled }` |
| GET | `/v1/snapshot` | full rule set, for local evaluation by `flag-client` |
| GET | `/v1/stream` | SSE: `snapshot` on connect, then `flag.updated` / `flag.deleted`; heartbeat every 25s; supports `Last-Event-ID` |

## 3. Dashboard

Design: the public home page (`apps/dashboard/src/landing/LandingPage.tsx`) is the visual reference, and every screen matches it.

- **Palette:** near-black ink ground `#0b0d0c` with `#151817` cards. Lime `#c4f04a` is the single accent: primary buttons (with ink text), live state, focus and glows. Flame `#ff5a24` marks danger, iris `#6b5cf6` marks the Testing state.
- **Type:** Inter Tight throughout. Headlines are bold Title Case with tight tracking (-0.04 to -0.055em). Body text is white at 55–60%. Geist Mono only for keys and IDs.
- **Shape:** 9px buttons, 16–20px cards, lime glows in the lower corners.
- **Layout:** the signed-in app uses a sidebar. Login, register and invite are two sections with no site header: the form, and the owner's desk illustration whose monitor mirrors it (owner decision, 2026-10-25).
- **Flag states:** Live = lime, Testing = iris, Inactive = grey.
- **Motion:** the visual and motion work uses the Emil Kowalski motion and Impeccable design skills. Easing is purposeful and durations short, motion explains state changes (toggle, card moving between columns, toast), and `prefers-reduced-motion` is respected everywhere.

| Page | Route | Access |
|---|---|---|
| Login, Register | `/login`, `/register` | public |
| Accept invite | `/invite/:token` | public |
| Flags board | `/flags` | all — Inactive / Testing / Live columns, search, filters, create |
| Flag detail | `/flags/:id` | all — toggle, description, targets, all-users switch, history, "connected" indicator |
| End-user lookup | `/end-users` | all — search `U001`, see and toggle their flags |
| Team | `/team` | admin — members, roles, invites |
| Audit log | `/audit` | admin |
| Settings | `/settings` | admin — org name, API keys |
| Organizations | `/admin` | superadmin |

Every page has loading, empty and error states, works at 375px width, and passes keyboard navigation.

## 4. Demo customer app

- `demo-api` uses `packages/flag-client`: fetches `/v1/snapshot`, keeps the rules in memory, listens on `/v1/stream`, evaluates locally, and relays updates to its frontend over its own SSE endpoint. The API key stays in `demo-api/.env`.
- Look (owner decision, 2026-10-26): the demo is the customer's own app, "Acme", with its own brand (warm paper and teal, Geist). Light or dark follows `dark_mode`. Beside it is a FlagFlow-styled panel in ink and lime: the demo user picker, the live connection, the six flags for that user, and a log of changes.
- `npm run demo:key` creates the demo backend's API key for the seeded Acme org.
- `demo-web`: pick a demo user (`U001`–`U005`), and six features react live:

| Flag | ON | OFF |
|---|---|---|
| `dark_mode` | dark theme | light theme |
| `chat_widget` | chat bubble | hidden |
| `analytics_dashboard` | analytics page | locked |
| `new_checkout` | redesigned checkout | old checkout |
| `beta_banner` | beta banner | none |
| `export_report` | Export PDF button | hidden |

## 5. Build phases

Each phase ends with the **phase gate** (section 6) passing, then one commit pushed to `main`.

| # | Phase | Delivers | Done when |
|---|---|---|---|
| 0 | Repo & tooling | workspaces, TS/ESLint/Prettier configs, docker compose, root scripts (`dev`, `test`, `verify`, `security`), GitHub Actions running `verify`, README | `docker compose up -d && npm run dev` starts everything; CI green |
| 1 | API foundation | Express app, env validation, logger, error handler, `/api/health` (checks Postgres + Redis), Prisma schema + first migration, seed (superadmin + demo org + demo flags) | health is green; seed runs twice without errors |
| 2 | Auth & sessions | register, login, refresh rotation with reuse detection, logout, Redis sessions + denylist, rate limits, `requireRole` | auth tests + attack tests (JWT tampering, brute force, reuse) pass |
| 3 | Team & invites | invites with Mailpit, accept flow, roles, deactivate, last-admin guard | invited user can join; expired/revoked/reused tokens fail |
| 4 | Flags core | flag CRUD, toggle, targets, end-user lookup, audit log, snapshot invalidation + publish | cross-tenant tests prove org isolation on every route; every change writes an audit log row |
| 5 | Public API & live updates | API keys, `evaluate`, `snapshot`, SSE stream with Redis fan-out, `flag-client` package | toggle → SSE event in under 1s; revoked key rejected; org B never sees org A's events |
| 6 | Dashboard foundation | design system (tokens, background, motion primitives), app shell, auth pages, API client with silent refresh | can register, log in, refresh and log out in the browser |
| 7 | Dashboard features | flags board, flag detail, end-user lookup, team, audit log, settings, superadmin | Playwright covers the main journeys; no console errors |
| 8 | Demo app | demo-api + demo-web with six live features | toggling `dark_mode` in the dashboard flips U001's demo app live, no refresh, no redeploy |
| 9 | Hardening & deploy | OpenAPI docs, Postman collection, load test on `/v1/flags/evaluate`, production config, deploy (Vercel + Render + managed Postgres/Redis) | full demo works on deployed URLs; gate passes against production build |

## 6. Phase gate (run at the end of every phase)

1. **Code quality:** `npm run verify` = typecheck + lint + unit/integration tests + build, all workspaces.
2. **UI check** (from phase 6): run the apps, check every page in the browser at desktop and 375px widths, zero console errors, Playwright suite green.
3. **Broken links** (from phase 6): linkinator crawl of the dashboard and demo-web — zero broken internal links.
4. **Security** (`npm run security`):
   - `npm audit --audit-level=high` — zero high/critical.
   - gitleaks — no secrets in the repo or history.
   - semgrep (OWASP + Node/TypeScript rulesets) — zero high findings.
   - Attack suite in `security/` (Vitest), run against every API route that exists so far: cross-org IDOR, role escalation, mass assignment (`role`, `orgId`, `id` in bodies), JWT tampering (`alg: none`, wrong secret, expired, denylisted, other org), refresh reuse, API key guessing and revoked keys, SQL/NoSQL injection payloads, stored XSS payloads, oversized bodies, CORS origin checks, rate-limit bypass attempts (header spoofing), SSE cross-tenant leakage, timing differences on login.
   - OWASP ZAP API scan against the generated OpenAPI spec (from phase 2).
   - Findings and fixes written to `security/reports/phase-N.md`; anything high is fixed before the push.
5. **Commit & push:** one commit per phase (`feat(phase-N): …`), authored with the repo owner's git identity, no AI attribution trailers or mentions, pushed to `main`.

## 7. Environment variables

`apps/api/.env`
```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://flagflow:flagflow@localhost:5432/flagflow
REDIS_URL=redis://localhost:6379/0
JWT_ACCESS_SECRET=          # 32+ random bytes
REFRESH_TOKEN_TTL_DAYS=7
DASHBOARD_ORIGIN=http://localhost:5173
SMTP_URL=smtp://localhost:1025
MAIL_FROM="FlagFlow <no-reply@flagflow.local>"
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
```
`apps/dashboard/.env` → `VITE_API_URL=http://localhost:4000/api`
`apps/demo-api/.env` → `PORT=4100`, `FLAGFLOW_URL=http://localhost:4000`, `FLAGFLOW_API_KEY=`, `DEMO_WEB_ORIGIN=http://localhost:5174`
`apps/demo-web/.env` → `VITE_DEMO_API_URL=http://localhost:4100`

Tests use `flagflow_test` on Postgres and Redis DB `1`.

## 8. Out of scope (v1)

Percentage rollouts / A/B tests, environments (dev/staging/prod per flag), analytics, billing, public npm SDK, users in multiple orgs, SSO.
