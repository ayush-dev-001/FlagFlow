# Phase 2 security report: auth and sessions

Date: 2026-10-22. Run with `npm run security`, plus a full-severity semgrep pass.

| Check                             | Result                                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm audit --audit-level=high`    | 0 vulnerabilities                                                           |
| gitleaks v8.24.2 (working tree)   | No leaks found                                                              |
| semgrep 1.180.0 (OWASP, Node, TS) | 115 files scanned, 0 findings at any severity                               |
| Attack suite                      | 42 / 42 passed (`security/api-foundation.test.ts`, `security/auth.test.ts`) |
| OWASP ZAP API scan (20261008)     | 0 FAIL, 0 WARN; 119 passive rules passed; 4 informational alerts (below)    |

## ZAP informational alerts (no action)

| Alert                                    | Why it's expected                                                    |
| ---------------------------------------- | -------------------------------------------------------------------- |
| Client error response code returned (30) | ZAP's probes for missing paths and bad input correctly get 4xx.      |
| Authentication request identified (1)    | ZAP found `POST /api/auth/login`. This is detection, not a weakness. |
| Non-storable content (5)                 | Auth responses aren't cacheable, as intended.                        |
| Storable and cacheable content (2)       | `/api/health` and `/api/docs` hold no user data.                     |

No findings to fix this phase.

## Attack coverage

- **JWT tampering:** `alg: none` with and without a signature, `HS512`/`RS256`/`ES256` headers on a real payload (algorithm confusion), a wrong secret, an expired token with a live session, a role-escalated payload, a valid signature with an unknown session, a denylisted token, and malformed or oversized `Authorization` headers. All get 401.
- **Cross-tenant:** an org A token sent with org B's id in a header and the query string still only ever returns org A.
- **Refresh tokens:** replaying a rotated token revokes the session, which also kills the victim's newer refresh and access tokens. Refresh and access tokens can't stand in for each other. Refresh needs `X-Requested-With` (CSRF).
- **Brute force:** login is limited to 5 per minute per IP + email and 20 per minute per IP, and registration to 20 per minute per IP.
- **Rate-limit bypass:** rotating `X-Forwarded-For` doesn't reset counters (`TRUST_PROXY=0`). Case and whitespace variants of an email share one counter.
- **Injection:** SQL payloads in login are just failed logins. In register they're stored as plain text. NoSQL operator objects and arrays fail validation.
- **Stored XSS:** script and `onerror` payloads come back as JSON strings with `nosniff`.
- **Mass assignment:** `role`, `orgId` and `id` in the register body are stripped.
- **CORS:** foreign origins can't make credentialed preflights to `/api/auth/refresh`.
- **Timing:** for an unknown email, the median login time is within 0.6–1.6× of a wrong password, because both run one bcrypt compare at cost 12.

## Design notes

- Access tokens are HS256 with the algorithm pinned, `iss`/`aud` checked, a 15-minute lifetime, and a `jti` and `sid`. Every request checks the Redis denylist and the session key.
- Refresh tokens are `sid.secret`, stored as SHA-256 in an httpOnly, Secure, SameSite=Strict cookie scoped to `/api/auth`. Rotation is a single conditional UPDATE, so concurrent replays can't both win. A session's lifetime is fixed at login and isn't extended by refresh.
- Rate limiters use Redis and fail closed if it's unavailable.
- If Redis is flushed, users are logged out until their next refresh, which restores the session from Postgres.
