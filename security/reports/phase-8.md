# Phase 8 security report: demo app

Date: 2026-10-26. Run with `npm run security`.

| Check                          | Result                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `npm audit --audit-level=high` | 0 vulnerabilities                                            |
| gitleaks (working tree)        | No leaks found                                               |
| semgrep (OWASP, Node, TS)      | 0 blocking findings                                          |
| Attack suite                   | 95 / 95 passed (adds `demo-api.test.ts`)                     |
| OWASP ZAP, dashboard pass      | 0 FAIL, 0 WARN, 120 passive rules passed; informational only |
| OWASP ZAP, public `/v1` pass   | 0 FAIL, 0 WARN, 120 passive rules passed; informational only |

## New attack surface

`demo-api` is a sample customer backend. It has no accounts and no database. Its only secret is the FlagFlow API key, and it serves a fixed catalogue.

- **The API key stays on the server.** It is read from `apps/demo-api/.env`, which is gitignored and confirmed ignored with `git check-ignore`. It is used only by `flag-client` for calls to FlagFlow. No route returns it, and the browser app talks to demo-api only. `npm run demo:key` writes the key to that file and never prints it; only the prefix is shown.
- **Features are gated on the server.** Analytics data, the PDF export and the checkout flow are decided by the flags on the server. A client that sends its own "on" (headers, cookies or a `flow` field) still gets 403, or the classic flow.
- **CORS:**
  - Only `DEMO_WEB_ORIGIN` receives `Access-Control-Allow-Origin`. Lookalike origins (`…5174.evil.example`) and `null` get none, preflight included.
  - The API sends no credentials, so there is no cookie to steal.
- **Input:**
  - `userId` must match the same pattern FlagFlow uses for end-user IDs, or the request gets 400. This is checked before the ID reaches the PDF filename header, so CRLF and quotes can't inject headers.
  - Checkout bodies are capped at 16 KB (413 above that), and items must be 1–50 known product IDs.
  - Object payloads such as `{ $gt: '' }` are rejected.
- **Headers:** every response sends `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`, and `X-Powered-By` is off.

ZAP scans the FlagFlow API from its OpenAPI spec. demo-api has no spec and isn't part of the product, so the in-process attack tests above cover it instead.

## Findings and fixes

None at medium or above.

## Done-when

`e2e/demo.spec.ts` registers an org in the dashboard and reads its one-time key from the welcome page. It then starts demo-api with that key and opens the demo twice, as U001 and as U002. Turning `dark_mode` (listed for U001) on in the dashboard flips U001's demo to dark within 1 s. A marker set on the page before the toggle survives, which proves there was no reload. U002's demo stays light and logs "changed, no effect for U002". Turning the flag off flips U001 back, also within 1 s and without a reload.
