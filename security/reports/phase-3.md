# Phase 3 security report: team and invites

Date: 2026-10-22. Run with `npm run security`, plus a full-severity semgrep pass.

| Check                             | Result                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm audit --audit-level=high`    | 0 vulnerabilities                                                                                |
| gitleaks v8.24.2 (working tree)   | No leaks found                                                                                   |
| semgrep 1.180.0 (OWASP, Node, TS) | 122 files scanned, 0 findings at any severity after the fix below                                |
| Attack suite                      | 56 / 56 passed (`api-foundation`, `auth`, `team`)                                                |
| OWASP ZAP API scan (20261008)     | 0 FAIL, 0 WARN, 120 passive rules passed; 3 informational alerts. Authenticated as an org admin. |

## Findings and fixes

| Severity | Finding                                                                                                 | Fix                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Error    | semgrep `react-insecure-request`: the ZAP harness in `scripts/security.mjs` fetched `http://127.0.0.1`. | Reverted to `http://localhost` (exempt as local-only). The scan target is never remote. |

No findings in application code.

## ZAP: what changed this phase

- **Authenticated scan.** The harness registers a throwaway org admin and sends its token on every request (`ZAP_AUTH_HEADER_VALUE`). Logout is removed from the spec ZAP gets, so the token survives the scan. Afterwards a probe confirms the token still works. Evidence on team routes is 400, 404 and 409 responses (including the last-admin guard), not 401s.
- **Rate limits scaled for the scanner only.** `RATE_LIMIT_SCALE=100` on the scan instance stops ZAP being throttled into testing nothing. The env schema refuses any value but 1 in production. The real limits are covered by the attack suite.
- **Bounded run time.** The active scan is capped at 5 minutes (1 per rule).
- **Fail-fast reachability check.** A container-to-host check runs before the scan. In one run Docker Desktop lost host networking and ZAP retried for nearly three hours without reaching the API; that now fails in seconds.

Informational alerts: client-error responses (46, expected 4xx for bad input and unknown ids), authentication request identified (login), non-storable content (auth responses). No action.

## Attack coverage

- **Cross-org IDOR:** org B's admin can't list, change, deactivate or revoke anything of org A; every attempt is a 404 and the database is unchanged. Org ids smuggled through headers, the query string or the body are ignored.
- **Role escalation:** members get 403 on every admin route. SUPERADMIN can't be assigned by PATCH or by invite. A superadmin token (no org) gets no team access.
- **Mass assignment:** PATCH ignores `email`, `orgId`, `passwordHash` and `id`. The accept body can't pick its role, email or org.
- **Immediate effect:** a deactivated member's live access token is rejected on the next request, because their sessions are revoked.
- **Invite tokens:** guessed, truncated, padded, case-flipped, SQL and path-traversal tokens all get the same 404 body. Token guessing is rate limited. Two simultaneous accepts of one invite create exactly one user. Only the token's SHA-256 is stored.
- **Email header injection:** CR/LF and comma-separated addresses in an invite email fail validation, and no mail is sent.
- **HTML injection in email:** org and inviter names are escaped in the HTML part (checked end to end through Mailpit).
- **SQL in `:id`:** returns 404.

## Design notes

- Changes to an org's admins lock the org row (`SELECT … FOR UPDATE`), so two admins demoting each other at once can't leave zero admins. There's an integration test for exactly that race.
- Any role or active-status change revokes the member's sessions in Postgres and Redis. Tokens carry the role, so a stale one must not outlive the change.
- A new invite to the same email revokes the previous pending one, so only the latest link works.
- Unknown, expired, revoked and used invites return one identical 404, so a token's state can't be probed.
