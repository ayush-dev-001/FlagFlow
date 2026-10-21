# Phase 0 security report: repo and tooling

Date: 2026-10-21. Run with `npm run security`, plus a full-severity semgrep pass.

| Check                             | Result                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `npm audit --audit-level=high`    | 0 vulnerabilities                                                                |
| gitleaks v8.24.2 (working tree)   | No leaks found                                                                   |
| semgrep 1.180.0 (OWASP, Node, TS) | 83 files scanned; 0 findings after the fix below                                 |
| Attack suite (`security/`)        | No tests yet; the only routes are placeholder health checks with no data or auth |
| OWASP ZAP API scan                | Not applicable until phase 2 (no OpenAPI spec yet)                               |

## Findings and fixes

| Severity | Finding                                                                  | Fix                                   |
| -------- | ------------------------------------------------------------------------ | ------------------------------------- |
| Warning  | `github-actions-mutable-action-tag`: `actions/checkout@v4` in `ci.yml`   | Pinned to commit `11d5960a…` (v4.4.0) |
| Warning  | `github-actions-mutable-action-tag`: `actions/setup-node@v4` in `ci.yml` | Pinned to commit `49933ea5…` (v4.4.0) |

No high findings.

## Hardening already in place

- Docker services bind to `127.0.0.1` only.
- `.env` files are gitignored and created only by `npm run setup:env`, with generated secrets.
- The CI workflow has a read-only `contents` permission.
- Local guards block force-push, destructive git and database commands, writes to `.env` and committed secrets, and run verify and gitleaks before every push.
