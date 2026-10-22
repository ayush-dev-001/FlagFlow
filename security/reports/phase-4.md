# Phase 4 security report: flags core

Date: 2026-10-22. Run with `npm run security`.

| Check                             | Result                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm audit --audit-level=high`    | 0 vulnerabilities                                                                                |
| gitleaks v8.24.2 (working tree)   | No leaks found                                                                                   |
| semgrep 1.180.0 (OWASP, Node, TS) | 0 blocking findings                                                                              |
| Attack suite                      | 69 / 69 passed (`api-foundation`, `auth`, `team`, `flags`)                                       |
| OWASP ZAP API scan (20261008)     | 0 FAIL, 0 WARN, 120 passive rules passed; 3 informational alerts. Authenticated as an org admin. |

No findings to fix this phase. ZAP's evidence on the flag, end-user and audit routes is 400 and 404 responses: authenticated and validated, not 401s. The 3 informational alerts are the same expected ones as phase 3: client errors for bad input, login identified, and non-storable auth responses.

## Done-when: org isolation on every route

`security/flags.test.ts` attacks every route this phase adds, from a second org:

| Route                                          | Cross-org result                            |
| ---------------------------------------------- | ------------------------------------------- |
| `GET /api/flags` (all states, search)          | Empty list                                  |
| `GET /api/flags/:id`                           | 404                                         |
| `PATCH /api/flags/:id`                         | 404, flag unchanged                         |
| `POST /api/flags/:id/toggle`                   | 404, flag unchanged                         |
| `POST /api/flags/:id/targets`                  | 404, targets unchanged                      |
| `DELETE /api/flags/:id`                        | 404, flag still exists                      |
| `GET /api/end-users/:id/flags`                 | Empty list for a user org A targets         |
| `GET /api/audit-logs` (by flag, actor, cursor) | Only the caller's own entries               |
| Redis `ff:events:{orgId}`                      | Org A's changes never reach org B's channel |

Org ids smuggled in the body, the query string or headers are ignored. Target rows can't be pointed at another org.

## Done-when: every change writes an audit row

The integration tests assert exactly one row per change, in order: `FLAG_CREATED`, `FLAG_TOGGLED`, `FLAG_UPDATED`, `FLAG_TARGETS_CHANGED` and `FLAG_DELETED`. Each row has the actor, the org and before/after metadata. A target change that adds nothing and removes nothing writes no row and doesn't bump the version.

## Other attack coverage

- **Roles:** members can't delete flags or read the audit log.
- **Mass assignment:** PATCH can't set `enabled`, `key`, `orgId`, `version` or `createdById`. Create ignores `enabled`, `orgId` and `version`, so every flag starts off.
- **Injection:** SQL in search, flag ids and end-user ids is inert. LIKE wildcards in search are escaped, so `%` and `_` match literally.
- **Stored XSS:** script payloads in descriptions come back as JSON strings.
- **Abuse:** a flag can't grow past 10,000 targets, at most 1,000 targets go per request, and wrong types and operator objects are rejected.

## Design notes

- Every change runs in one transaction that row-locks the flag, writes the change and its audit row, and bumps `organization.flags_version`. That counter is the version used by snapshots and SSE events, so events are strictly ordered per org.
- After the commit, the org's snapshot key is deleted and an event is published on `ff:events:{orgId}`. If Redis fails at that point, the error is logged and the request still succeeds, because Postgres holds the change. The stale snapshot then lasts until its 1-hour TTL. Phase 5 should check the cached snapshot's version against `flags_version` to close that window.
- The end-user lookup uses `evaluate()` from `packages/shared`, the same function the public API and `flag-client` will use.
