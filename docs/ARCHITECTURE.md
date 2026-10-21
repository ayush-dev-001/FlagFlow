# FlagFlow — Architecture

**Goal:** let teams enable or disable features for specific users of their app **without redeploying it**.

**Stack:** React + TypeScript (Vite) · Node.js + Express + TypeScript · PostgreSQL (Prisma) · Redis

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Team["Customer team"]
        Admin["Org admin / member"]
    end

    subgraph EndUsers["Customer's end users"]
        EU["U001, U002, ..."]
    end

    subgraph FF["FlagFlow platform"]
        Dash["Dashboard<br/>React + Vite + TS<br/>TanStack Query, Tailwind"]
        API["FlagFlow API<br/>Node + Express + TS"]
        PG[("PostgreSQL<br/>source of truth")]
        RD[("Redis<br/>cache · pub/sub · rate limits · sessions")]
        Mail["Mailer<br/>Mailpit in dev / SMTP in prod"]
    end

    subgraph Demo["Customer app (demo)"]
        DemoAPI["Demo API<br/>Express + flag-client"]
        DemoWeb["Demo web<br/>React"]
    end

    Admin -->|HTTPS + JWT access token<br/>refresh token cookie| Dash
    Dash -->|REST /api/*| API
    API -->|Prisma| PG
    API <-->|cache, rate limit,<br/>sessions, pub/sub| RD
    API -->|invite emails| Mail

    DemoAPI -->|"REST /v1/* + x-api-key"| API
    API -.->|"SSE /v1/stream<br/>live flag changes"| DemoAPI
    DemoWeb -->|REST + SSE relay| DemoAPI
    EU --> DemoWeb
```

Two kinds of callers, two kinds of credentials:

| Caller | Credential | Routes |
|---|---|---|
| Dashboard users (admins, members, superadmin) | JWT access token (15 min) + rotating refresh token in an httpOnly cookie | `/api/*` |
| Customer backends (the demo API) | Org API key in `x-api-key` header — server-to-server only | `/v1/*` |

End users (`U001`…) never log into FlagFlow. FlagFlow only knows them as ID strings sent by the customer's backend.

## 2. Inside the FlagFlow API

```mermaid
flowchart TB
    Req["Incoming request"] --> Sec["helmet · CORS · body size limit · request id · pino logger"]
    Sec --> Split{"Route prefix"}

    Split -->|/api/*| RL1["Rate limit<br/>(Redis)"] --> JWT["verifyJWT<br/>signature, expiry,<br/>Redis denylist + session check"] --> Role["requireRole"] --> Val1["zod validation"] --> Mods
    Split -->|/v1/*| RL2["Rate limit per API key<br/>(Redis)"] --> Key["verifyApiKey<br/>SHA-256 → Redis → Postgres"] --> Val2["zod validation"] --> Pub

    subgraph Mods["Dashboard modules (org-scoped)"]
        Auth["auth"]
        Team["team + invites"]
        Flags["flags"]
        Users["end-user lookup"]
        Audit["audit logs"]
        Org["org + API keys"]
        SA["superadmin"]
    end

    subgraph Pub["Public modules"]
        Eval["evaluate"]
        Snap["snapshot"]
        Stream["SSE stream"]
    end

    Flags --> FS["flagService<br/>Postgres transaction + audit log"]
    FS --> Inv["invalidate Redis snapshot"] --> PubMsg["PUBLISH ff:events:{orgId}"]
    Eval --> Cache["read snapshot from Redis<br/>(miss → load from Postgres)"]
    Snap --> Cache
    Stream --> Sub["PSUBSCRIBE ff:events:*<br/>fan out to this org's connections"]
```

Rules every module follows:
- The org ID always comes from the verified JWT or API key, **never** from the request body or URL.
- Every change runs inside a Postgres transaction that also writes an `AuditLog` row.
- After the transaction commits: delete the org's Redis snapshot, then publish an event.
- Flag evaluation uses a single shared function, `evaluate()` from `packages/shared`, so the API, the flag-client and the tests can never disagree.

## 3. Key flows

### 3.1 Team toggles a flag → demo app updates live (no redeploy)

```mermaid
sequenceDiagram
    autonumber
    actor M as Team member
    participant D as Dashboard
    participant A as FlagFlow API
    participant P as PostgreSQL
    participant R as Redis
    participant C as Demo API (flag-client)
    participant W as Demo web

    C->>A: GET /v1/stream (x-api-key)
    A-->>C: event: snapshot {version 41, flags}
    W->>C: GET /events (SSE relay)

    M->>D: Toggle "dark_mode" ON
    D->>A: PATCH /api/flags/:id/toggle (JWT)
    A->>P: BEGIN, update flag (version 42), insert audit_log, COMMIT
    A->>R: DEL ff:org:{orgId}:snapshot
    A->>R: PUBLISH ff:events:{orgId} {flag dark_mode, version 42}
    A-->>D: 200 {flag}
    R-->>A: message (every API instance receives it)
    A-->>C: event: flag.updated {dark_mode, version 42}
    C->>C: update in-memory rules
    C-->>W: event: flags {dark_mode: true}
    W->>W: re-render in dark mode
```

If the stream drops, the flag-client reconnects with `Last-Event-ID: 42`. If it has missed events, the API sends a fresh snapshot.

### 3.2 Public flag check (cache-aside)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer backend
    participant A as FlagFlow API
    participant R as Redis
    participant P as PostgreSQL

    C->>A: GET /v1/flags/evaluate?userId=U001 (x-api-key)
    A->>R: INCR ff:rl:key:{keyId} (rate limit)
    A->>R: GET ff:apikey:{sha256}
    alt key not cached
        A->>P: SELECT api_key WHERE key_hash = ... AND revoked_at IS NULL
        A->>R: SET ff:apikey:{sha256} orgId EX 600
    end
    A->>R: GET ff:org:{orgId}:snapshot
    alt cache miss
        A->>P: SELECT flags + targets WHERE org_id = ...
        A->>R: SET ff:org:{orgId}:snapshot EX 3600
    end
    A->>A: evaluate(snapshot, "U001")
    A-->>C: 200 {version, flags: {dark_mode: true, chat_widget: false}}
```

Unknown flag, unknown user, or any error on the customer's side ⇒ `false` (safe default).

### 3.3 Dashboard authentication

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant D as Dashboard
    participant A as API
    participant P as PostgreSQL
    participant R as Redis

    U->>D: email + password
    D->>A: POST /api/auth/login
    A->>P: find user, bcrypt compare
    A->>P: insert session (refresh token hash)
    A->>R: SET ff:session:{sid} EX 7d
    A-->>D: {accessToken (15 min, jti, sid)} + Set-Cookie refresh (httpOnly, Secure, SameSite=Strict)

    Note over D,A: access token expires
    D->>A: POST /api/auth/refresh (cookie)
    A->>P: rotate refresh token (reuse of an old one ⇒ revoke the whole session)
    A-->>D: new access token + new cookie

    U->>D: Log out
    D->>A: POST /api/auth/logout
    A->>P: revoke session
    A->>R: DEL ff:session:{sid} and SET ff:deny:{jti} EX remaining-ttl
```

### 3.4 Invite a member

```mermaid
sequenceDiagram
    autonumber
    actor Ad as Admin
    participant A as API
    participant P as PostgreSQL
    participant E as Mailer
    actor N as New member

    Ad->>A: POST /api/team/invites {email, role}
    A->>P: insert invite (token hash, expires in 48h) + audit
    A->>E: email link /invite/{raw token}
    N->>A: GET /api/auth/invites/{token}
    A-->>N: {email, organization}
    N->>A: POST /api/auth/invites/{token}/accept {name, password}
    A->>P: create user, mark invite accepted, audit (one transaction)
    A-->>N: logged in
```

## 4. Data model (PostgreSQL via Prisma)

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : has
    ORGANIZATION ||--o{ API_KEY : has
    ORGANIZATION ||--o{ FLAG : owns
    ORGANIZATION ||--o{ INVITE : sends
    ORGANIZATION ||--o{ AUDIT_LOG : records
    FLAG ||--o{ FLAG_TARGET : targets
    USER ||--o{ SESSION : has
    USER ||--o{ AUDIT_LOG : performs

    ORGANIZATION {
        uuid id PK
        text name
        text slug UK
        bool is_active
        timestamptz created_at
    }
    USER {
        uuid id PK
        uuid org_id FK "null only for superadmin"
        citext email UK
        text name
        text password_hash
        enum role "SUPERADMIN | ADMIN | MEMBER"
        bool is_active
    }
    API_KEY {
        uuid id PK
        uuid org_id FK
        text name
        text prefix "ff_live_ab12 (display only)"
        text key_hash UK "SHA-256"
        timestamptz last_used_at
        timestamptz revoked_at
    }
    FLAG {
        uuid id PK
        uuid org_id FK
        text key "snake_case, unique per org"
        text description
        bool enabled "default false"
        bool target_all "default false"
        int version
        uuid created_by FK
        uuid updated_by FK
        timestamptz last_evaluated_at
    }
    FLAG_TARGET {
        uuid flag_id PK
        text end_user_id PK
        uuid org_id FK "for user lookup index"
    }
    INVITE {
        uuid id PK
        uuid org_id FK
        citext email
        enum role
        text token_hash UK
        enum status "PENDING | ACCEPTED | REVOKED"
        timestamptz expires_at
    }
    SESSION {
        uuid id PK
        uuid user_id FK
        text refresh_token_hash
        timestamptz expires_at
        timestamptz revoked_at
    }
    AUDIT_LOG {
        bigint id PK
        uuid org_id FK
        uuid actor_id FK
        uuid flag_id "nullable"
        enum action
        jsonb metadata "before / after"
        inet ip
        timestamptz created_at
    }
```

Indexes: `flag (org_id, key) UNIQUE`, `flag_target (org_id, end_user_id)`, `audit_log (org_id, created_at DESC)`, `api_key (key_hash) UNIQUE`, `invite (token_hash) UNIQUE`.

**Kanban column (worked out, not stored):** `enabled = false` → *Inactive*; enabled for specific users → *Testing*; enabled with `target_all` → *Live*.

**Evaluation rule:** `enabled && (target_all || targets.has(userId))`.

## 5. Redis usage

| Purpose | Key / channel | Type | TTL | Written when |
|---|---|---|---|---|
| Flag snapshot cache | `ff:org:{orgId}:snapshot` | string (JSON: version + flags + targets) | 1 h | Cache miss; deleted on every flag change |
| API key → org | `ff:apikey:{sha256}` | string | 10 min | First use; deleted when the key is revoked |
| Live updates | `ff:events:{orgId}` | pub/sub channel | — | After every committed flag change |
| Rate limits | `ff:rl:{scope}:{id}` | counter (`rate-limit-redis`) | window | Every limited request |
| Active sessions | `ff:session:{sid}` | string (userId) | 7 days | Login / refresh; deleted on logout or revoke |
| Revoked access tokens | `ff:deny:{jti}` | string | rest of the token's 15 min | Logout, password change, member removal |

Redis is never the source of truth: if it is flushed, everything rebuilds from Postgres. The only thing lost is the denylist, which is why access tokens live just 15 minutes.

Rate limits: login 5 per minute per IP+email; `/api/*` 300 per minute per user; `/v1/*` 600 per minute per API key; open SSE streams capped at 20 per key.

## 6. Repository layout (npm workspaces monorepo)

```
FlagFlow/
├── apps/
│   ├── api/            # FlagFlow API — Express + Prisma + ioredis
│   ├── dashboard/      # FlagFlow dashboard — React + Vite
│   ├── demo-api/       # Demo customer backend — uses packages/flag-client
│   └── demo-web/       # Demo customer frontend — 6 flag-controlled features
├── packages/
│   ├── shared/         # zod schemas, shared types, evaluate()
│   └── flag-client/    # Node client: snapshot + SSE + local evaluation
├── e2e/                # Playwright tests across dashboard + demo
├── security/           # attack test suite, ZAP config, scan scripts
├── docs/               # this file, API reference (generated OpenAPI)
├── docker-compose.yml  # postgres, redis, mailpit
└── package.json        # workspaces + root scripts (dev, test, verify, security)
```

## 7. Local development

```mermaid
flowchart LR
    subgraph Docker["docker compose"]
        PG[("postgres:16<br/>:5432")]
        RD[("redis:7<br/>:6379")]
        MP["mailpit<br/>SMTP :1025 · UI :8025"]
    end
    API["api :4000"] --> PG
    API --> RD
    API --> MP
    Dash["dashboard :5173"] --> API
    DAPI["demo-api :4100"] --> API
    DWeb["demo-web :5174"] --> DAPI
```

`npm run dev` starts all four apps. `docker compose up -d` starts Postgres, Redis and Mailpit.

## 8. Production deployment

```mermaid
flowchart LR
    Browser["Browsers"] --> V1["Vercel<br/>dashboard"]
    Browser --> V2["Vercel<br/>demo-web"]
    V1 --> R1["Render web service<br/>FlagFlow API (2+ instances)"]
    V2 --> R2["Render web service<br/>demo-api"]
    R2 --> R1
    R1 --> PGp[("Managed Postgres<br/>Neon or Render")]
    R1 --> RDp[("Managed Redis<br/>Upstash or Render Key Value")]
    R1 --> SMTP["SMTP provider<br/>Resend / Brevo"]
```

Running several API instances is safe because the cache, rate limits, sessions and SSE fan-out all go through Redis, not process memory.

## 9. Security design

| Threat | Control |
|---|---|
| One org reading or changing another org's data (IDOR) | Org ID taken only from the token or key; every Prisma query filters on `orgId`; cross-tenant tests on every route |
| Privilege escalation | `requireRole` on every admin route; `role` and `orgId` never accepted from request bodies (zod strips unknown fields) |
| Stolen or forged JWT | HS256 with a 256-bit secret, `alg` pinned, 15 min lifetime, `jti` denylist, session check in Redis |
| Refresh token theft | httpOnly + Secure + SameSite=Strict cookie, rotation with reuse detection, stored hashed |
| CSRF | Refresh endpoint needs the SameSite cookie plus an `X-Requested-With` header; every other route uses a bearer token |
| API key leaks | Stored as SHA-256 only; shown once; can be revoked and rotated; server-to-server only (no browser CORS on `/v1`) |
| Brute force | Redis rate limits on login, invite accept and `/v1`; bcrypt cost 12 |
| Injection | Prisma parameterised queries; zod validation; flag keys must match `^[a-z0-9_]{2,64}$` |
| Stored XSS | React escaping; no `dangerouslySetInnerHTML`; strict Content-Security-Policy on the dashboard |
| Leaking data across tenants over SSE | Stream subscriptions keyed by the org from the API key; tests assert org B never receives org A's events |
| Secrets in git | `.env` gitignored; gitleaks scan before every push |
| Vulnerable dependencies | `npm audit --audit-level=high` in the verify gate |
