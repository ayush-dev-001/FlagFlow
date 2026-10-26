# Phase 9 security report: hardening and deploy

Date: 2026-10-26.

The gate ran twice: locally against the production build (`npm run security` plus the full suites), and against the live deployment:

- https://flagflow.onrender.com: the API and the dashboard, on one Render service.
- https://flagflow-demo-api.onrender.com: the demo backend.
- https://flag-flow.vercel.app: the demo app.

The owner approved creating throwaway test orgs on production for these checks.

## Local gate

| Check                          | Result                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify`               | 141 tests, typecheck, lint, format and build all pass                                                                    |
| `npm audit --audit-level=high` | 0 vulnerabilities                                                                                                        |
| gitleaks (history and tree)    | No leaks found (see the allowlist note below)                                                                            |
| semgrep                        | 0 blocking findings                                                                                                      |
| Attack suite                   | 95 / 95 passed                                                                                                           |
| OWASP ZAP, both API passes     | 0 FAIL, 0 WARN, 120 passive rules each                                                                                   |
| Playwright (1440 and 375 px)   | 38 passed, 4 skipped by design; zero console errors                                                                      |
| Production build, locally      | Sign-up, the welcome page, flags, and a reload restoring the session from the first-party cookie, with no console errors |

## Production gate

| Check                                                  | Result                                                                                                                |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Postman "FlagFlow Smoke" (13 requests)                 | 17 / 17 assertions pass                                                                                               |
| Playwright auth and link crawl                         | 9 passed, 1 skipped (it needs the local Mailpit)                                                                      |
| Live updates: toggle to `flag.updated` on `/v1/stream` | 5 toggles: 335–507 ms from sending the toggle to receiving the event, internet round trips included                   |
| Demo app                                               | Your dashboard changes reached U001's live demo with no reload (`chat_widget` off, then on; `analytics_dashboard` on) |
| Invite email                                           | 201 in 1.9 s; Resend accepted it                                                                                      |
| Load test, 1 VU for 1 min (`scripts/load-test.mjs`)    | **Failed its p95 < 500 ms threshold: p95 577 ms**, 0 errors, 137 requests (see below)                                 |
| ZAP baseline, dashboard                                | 0 FAIL; 5 WARN (see below)                                                                                            |
| ZAP baseline, demo-web                                 | 0 FAIL; 7 WARN while Vercel still built from `main` without `vercel.json` (see below)                                 |

### Load test

**Locally**, against a built API with the rate limits scaled up, 50 VUs held for 2 minutes:

- 27,700 requests at 229 req/s.
- p95 72 ms, p99 89 ms, 0 errors.
- Passed p95 < 100 ms.
- The API process used about 27% of one core. The ceiling came from the load generator and Docker networking on the same machine.

**Locally at the real limits:**

- A single key stops at 600 requests a minute (624 succeeded, counting the window edge).
- Every other request got a fast 429, with p95 23 ms and no transport errors.

**On production:**

- The fastest request took 284 ms, which is the network round trip from the test machine to Render's US region.
- p95 was 577 ms, so the run failed its 500 ms threshold. The threshold was not changed after the fact.
- Customer backends evaluate flags locally with `flag-client` (snapshot plus stream), so this endpoint isn't on their request path.

## Findings and fixes

| Severity            | Finding                                                                                                                                                                                                                                                                                                | Fix                                                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High (availability) | **Cross-site refresh cookie.** With the dashboard on `*.vercel.app` and the API on `*.onrender.com`, the `SameSite=Strict` refresh cookie would never be sent, so silent sign-in would break. Proxying `/api` through Vercel would let direct callers spoof `X-Forwarded-For` past the IP rate limits. | Owner decision: one Render service serves the API and the built dashboard (`DASHBOARD_DIST`), so the cookie is first-party and `TRUST_PROXY=1` matches the single load-balancer hop. Tests: `static.test.ts`.                                                        |
| High (availability) | **Invite email never sent.** Render's free plan blocks outbound SMTP: 465 and 587, and 2465 was unreachable too. Each invite hung for 2 minutes, then returned a generic 500 with the invite left pending.                                                                                             | SMTP now times out in 10 s. A failed send cancels the invite and returns `502 EMAIL_NOT_SENT` with a plain message. Production sends through Resend's HTTPS API (`RESEND_API_KEY`), and the key never appears in errors. Tests: `mailer.test.ts`, `invites.test.ts`. |
| Medium              | **Demo backend stuck on "reconnecting."** After a redeploy, flag-client reconnected to a stream that was already current, so no snapshot came. The demo backend never marked itself live again, and an origin pasted with a trailing slash blocked CORS.                                               | flag-client gains `onConnect`. demo-api's `/health` reports the last stream error (never the key) and accepts a trailing slash on `DEMO_WEB_ORIGIN`. Tests added.                                                                                                    |
| Low                 | **Over-broad CSP.** ZAP reported the CSP allowing any `https:` source for fonts and styles, plus missing Permissions-Policy and Cross-Origin-Embedder-Policy headers.                                                                                                                                  | The CSP is now `font-src 'self' data:` and `style-src 'self' 'unsafe-inline'`, with `Permissions-Policy` added and COEP `require-corp`. The rescan shows these three resolved.                                                                                       |
| Low                 | **No security headers on demo-web.** ZAP found no CSP, `nosniff` or frame protection: Vercel was building `main`, which didn't have `apps/demo-web/vercel.json` yet.                                                                                                                                   | Resolved by merging to `main`. Recheck after the merge (see the commit notes).                                                                                                                                                                                       |
| None                | **gitleaks false positives.** These were random example strings in the generated reference collection, and two fake `re_` keys in tests.                                                                                                                                                               | The generated collection is allowlisted. The fake keys are built at runtime; the one commit that held them as literals is allowlisted by SHA in `.gitleaks.toml`.                                                                                                    |

Remaining warnings on the live dashboard, no action:

- `style-src 'unsafe-inline'`: React and Motion set inline style attributes.
- Cache-control and "storable content": hashed assets are immutable by design; `index.html` is `no-cache`.
- "Suspicious comments": inside the minified bundle.
- "Modern web application": informational.

## Production notes

- Free web services sleep after about 15 minutes idle; the first request after that takes up to a minute.
- Free Postgres expires after 30 days.
- Free Key Value has no persistence: a restart ends every session.
- Without a verified domain, Resend only delivers to the account owner's address.
