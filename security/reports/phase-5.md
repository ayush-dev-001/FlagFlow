# Phase 5 security report: public API and live updates

Date: 2026-10-22. Run with `npm run security`.

| Check                             | Result                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high`    | 0 vulnerabilities                                                                                                         |
| gitleaks v8.24.2 (working tree)   | No leaks found                                                                                                            |
| semgrep 1.180.0 (OWASP, Node, TS) | 0 blocking findings                                                                                                       |
| Attack suite                      | 83 / 83 passed (adds `public-api.test.ts`)                                                                                |
| OWASP ZAP, dashboard pass         | 0 FAIL, 0 WARN, 120 passive rules passed; informational only. Bearer-authenticated.                                       |
| OWASP ZAP, public `/v1` pass      | 0 FAIL, 0 WARN, 120 passive rules passed after the fix below (119 before); informational only. `x-api-key`-authenticated. |

## Findings and fixes

| Severity                                      | Finding                                                                                                                                                                                                                                                                                                                                                                                         | Fix                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium (found from a ZAP informational alert) | **Cacheable per-org responses on `/v1`.** ZAP reported "Storable and Cacheable Content" for `/v1/snapshot` and the evaluate routes. The key travels in `x-api-key`, not `Authorization`, so HTTP caching rules allow a shared cache (a corporate proxy or CDN in front of a customer backend) to store one org's response and replay it for the same URL to a request carrying a different key. | Every `/v1` response, including rejections, now sends `Cache-Control: no-store` and `Vary: x-api-key`. Regression test in `security/public-api.test.ts`. |

Remaining informational alerts, no action:

- **Client error responses:** expected 4xx for bad input and unknown keys.
- **Authentication request identified:** the login route.
- **Non-storable content:** auth responses.
- **Sensitive information in URL:** the `userId` query parameter. It holds the customer's own end-user identifier (e.g. `U001`), not a credential, and is part of the documented contract. The API key itself is only ever sent in a header.

## Done-when

- **Toggle → SSE event in under 1 s:** `public.test.ts` measures the time from the dashboard toggle to the `flag.updated` event on an open stream, both with a raw SSE reader and through `flag-client`. Both assert under 1000 ms (local runs land in the low tens of ms).
- **Revoked key rejected:** revoking deletes the cached key → org entry, so the next request fails even though the key had just been cached. Every `/v1` route, including opening a stream, returns 401. Open streams using the key get an `error` event (`API_KEY_REVOKED`) and are closed, on every API instance, via `ff:apikeys:revoked`. `flag-client` stops with `FlagClientAuthError` instead of retrying.
- **Org B never sees org A's events:** stream fan-out is keyed by the org of the verified key. The tests check both the opening snapshot and live events, at the integration and attack-suite levels.

## Attack coverage

- **API-key guessing:**
  - Random well-formed keys get 401, and so do truncated, padded, case-flipped, wrong-prefix and suffixed copies of a real key.
  - After 30 rejected requests per minute per IP, further attempts get 429. Rotating `X-Forwarded-For` doesn't reset the counter, and valid traffic never counts toward it.
  - Only the key's SHA-256 is stored, in both Postgres and Redis.
- **Credential confusion:** API keys don't work on `/api`, and JWTs don't work on `/v1`, in either header.
- **Cross-tenant:** a key only ever sees its own org's snapshot and flags, whatever org ids are sent. Org B can't revoke org A's key.
- **Stream abuse:**
  - At most 20 open streams per key; tested with a lower cap. The limit is tracked in Redis across instances, with heartbeat-refreshed slots so a crashed instance's slots expire.
  - Exhausting one key's streams doesn't affect other orgs.
  - Crafted `Last-Event-ID` values (negative, huge, SQL) just get a fresh snapshot.
- **Injection:** SQL, script and oversized values in `userId` fail validation, and so do array-valued parameters. Malformed flag keys get 400.
- **CORS:** `/v1` sends no CORS headers to any origin, including the dashboard's, and preflights are not granted.

## Design notes

- **Snapshot cache-aside:**
  - A miss loads the version and flags in one REPEATABLE READ transaction.
  - After writing the cache, the version is re-checked against `organization.flags_version`, and the entry is dropped if a change committed in between. That closes the classic stale cache-aside race.
  - Snapshot invalidation after a change now retries before giving up.
- **Stream ordering:**
  - A new stream registers for events before its snapshot loads, and buffers them. After sending the snapshot, it delivers only buffered events with a higher version, so nothing is lost or duplicated in the gap.
  - Event ids are the org version, so `Last-Event-ID` resume is exact. A client that's current gets no snapshot; one that's behind gets a fresh snapshot.
- **ZAP scanning:** ZAP now runs two passes, because it can only send one auth header per run. `/v1/stream` and logout are excluded from ZAP; the attack suite covers both.
