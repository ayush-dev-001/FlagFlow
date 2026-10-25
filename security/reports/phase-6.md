# Phase 6 security report: dashboard foundation

Date: 2026-10-23. Run with `npm run security`, plus the UI checks this phase adds to the gate (PLAN.md §6.2–6.3).

| Check                                 | Result                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high`        | 0 vulnerabilities                                                                         |
| gitleaks v8.24.2 (working tree)       | No leaks found                                                                            |
| semgrep 1.180.0 (OWASP, Node, TS)     | 0 blocking findings                                                                       |
| Attack suite                          | 83 / 83 passed                                                                            |
| OWASP ZAP, dashboard and `/v1` passes | 0 FAIL, 0 WARN in both; informational alerts only                                         |
| Playwright (1440px and 375px)         | 21 passed, 3 skipped by design (desktop-only checks); zero console errors in every test   |
| Broken links                          | linkinator: 0 broken; rendered-link crawl: every internal link resolves (guest and admin) |

## Browser-side security decisions

- **Access token in memory only.** The dashboard never writes the JWT to `localStorage`, `sessionStorage` or a cookie. It lives in a module variable and is lost on reload by design.
- **Session restore.** On load the dashboard does one silent `POST /api/auth/refresh`, with the httpOnly, SameSite=Strict refresh cookie and `X-Requested-With`, then calls `/me`.
  - The refresh is attempted only when a non-secret `ff_had_session` hint is present in `localStorage`. The hint holds no token. It only avoids a guaranteed 401 on a guest's first visit.
- **Refreshing.**
  - One refresh runs at a time: concurrent 401s share a single refresh promise, so a burst of requests can't trigger refresh-token reuse detection against itself.
  - A proactive refresh runs a minute before expiry.
  - A failed refresh drops the user to the login page.
- **One-time API key.**
  - Shown only from in-memory state and never persisted.
  - `/welcome` sits outside the app shell, so there is no navigation away from it.
  - A `beforeunload` warning stays on until the user confirms they stored the key.
  - The page redirects away once the key is dismissed.
- **Error handling.** API errors map to field-level messages (`aria-invalid`, `aria-describedby`) or a single banner. Raw server details never render.
- **No `dangerouslySetInnerHTML`.** All server data renders through React escaping. Phase 2–4 attack tests store XSS payloads; they come back as inert strings.
- **Dev server.** `apps/dashboard/.impeccable/` (design-process notes) is denied in Vite's `server.fs.deny`, so it is never served.

## Known limitation

Two tabs refreshing at the same instant send the same refresh cookie twice. The API treats that as token reuse and revokes the session, so both tabs return to the login page. The single refresh in flight prevents this within one tab. Across tabs it needs a shared lock (e.g. `BroadcastChannel` or the Web Locks API). That's a candidate for phase 7.

## Test isolation fix

The e2e suite and the Vitest suites both used `flagflow_test`, and the attack suite truncates it. Running both at once broke e2e. E2E now has its own `flagflow_e2e` database, created by `docker/postgres/init.sql` for new volumes.

## Redesign round (2026-10-25)

The owner made the public home page the binding visual reference. The dashboard and the auth pages were restyled to its ink + lime world, and the home page ships in this commit. The gate was re-run on the full working tree.

| Check                                 | Result                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm audit --audit-level=high`        | 0 after the fixes below                                                                             |
| gitleaks (working tree)               | No leaks after allowlisting one false positive (below)                                              |
| Attack suite                          | 83 / 83 passed                                                                                      |
| OWASP ZAP, dashboard and `/v1` passes | 0 FAIL, 0 WARN, 120 passive rules each; informational only                                          |
| `npm run verify`                      | 117 tests, typecheck, lint, format and build all pass                                               |
| Playwright (1440px and 375px)         | 20 passed, 2 skipped by design; zero console errors; the home page is in the link crawl and capture |

### Findings and fixes

| Severity              | Finding                                                                                                                                                                                                                         | Fix                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| High                  | `body-parser` 2.0.0–2.3.0: denial of service via trailing bytes after a compressed body (GHSA-27r3-jxmh-p828), via Express                                                                                                      | `npm audit fix` → `body-parser@2.4.0`                                                                     |
| Moderate              | `nodemailer` ≤ 10.1.3: three `addressparser` flaws that can turn display text into a recipient (GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, GHSA-85x2-q946-cp5h). Relevant because invite emails parse an admin-supplied address. | Pinned `nodemailer@10.2.1`. The invite tests and the CRLF/comma header-injection attack tests still pass. |
| None (false positive) | gitleaks `generic-api-key` in `.impeccable/questions/seeds/*.json`. This is the design tool's local roll cache, and the matched value is a design-roll reproduction id, not a credential.                                       | Gitignored `.impeccable/questions/` and allowlisted it in `.gitleaks.toml`.                               |

### Front-end notes for the redesign

- **Self-hosted fonts.** Inter Tight and Geist Mono come from fontsource. There are no third-party font hosts.
- **Photos.** The four home-page photos are free-license stock, shown in greyscale. Their origin is recorded in a `.webp.json` sidecar next to each image.
- **No new runtime behaviour.** The redesign changes styling and copy only. Auth, session and key handling are as described above.
