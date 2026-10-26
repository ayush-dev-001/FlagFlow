# Phase 7 security report: dashboard features

Date: 2026-10-26. Run with `npm run security`.

| Check                          | Result                                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high` | 0 vulnerabilities                                                                        |
| gitleaks (working tree)        | No leaks found                                                                           |
| semgrep (OWASP, Node, TS)      | 0 blocking findings                                                                      |
| Attack suite                   | 89 / 89 passed (adds `admin.test.ts`)                                                    |
| OWASP ZAP, dashboard pass      | 0 FAIL, 0 WARN, 120 passive rules passed; informational only. Bearer-authenticated.      |
| OWASP ZAP, public `/v1` pass   | 0 FAIL, 0 WARN, 120 passive rules passed; informational only. `x-api-key`-authenticated. |

## New attack surface

Phase 7 is mostly the dashboard screens, which only call routes that already existed and were already covered. It adds three API routes, and each has its own attack tests:

- **`GET /api/admin/organizations`** and **`PATCH /api/admin/organizations/:id`** (superadmin only). These are the only routes not scoped to the caller's org, so they are the escalation target:
  - Org admins and members get 403 on both. Guests get 401.
  - A token claiming `SUPERADMIN` but signed with the wrong secret gets 401.
  - The PATCH body accepts only `isActive`. `name`, `slug`, `id` and `flagsVersion` in the body change nothing.
  - SQL and path junk in `:id` returns 400 or 404 and changes no rows.
- **Deactivation takes effect at once**, rather than when tokens expire:
  - Every session of the org's users is revoked, so live access tokens fail on their next request.
  - The org's API-key cache entries are dropped, and each active key is announced on `ff:apikeys:revoked`, so open SDK streams close on every instance.
  - Login, refresh and API-key checks already refused an inactive org.
  - Reactivating restores access. Each change writes an `ORG_STATUS_CHANGED` audit row.
- **`GET /api/flags/connections`** (the flag page's "connected" indicator). It counts the caller's own org only, and an API key can't call it.
  - Stream slots per org are kept in a Redis sorted set, refreshed by each heartbeat. Slots from a crashed instance expire, so the count holds across instances.

## Findings and fixes

None at medium or above.

Remaining informational alerts, no action. They are the same as in phase 5:

- **Client error responses:** expected 4xx for bad input.
- **Authentication request identified:** the login route.
- **Non-storable content:** auth responses.
- **Sensitive information in URL:** the `userId` query parameter, which holds the customer's own end-user ID and is not a credential.

## Front-end notes

- **Plain-text rendering:** user-supplied text (flag descriptions, names, end-user IDs, audit metadata) is rendered as React text, never as HTML. The stored-XSS payloads from the flags attack suite come back as inert strings.
- **One-time keys:** a new API key is shown once, in a dialog that can't be dismissed until the user confirms they stored it. It lives only in that mutation's memory and is never written to storage.
- **Board cards:** the cards use a stretched link with the switch above it, so the card has no button nested inside a link.
