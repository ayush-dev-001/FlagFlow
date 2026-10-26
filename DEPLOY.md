# Deploying FlagFlow

Production runs on three services:

- **Render: `flagflow`.** One web service runs the API and serves the built dashboard from the same origin. Keeping one origin keeps the login cookie first-party. Owner decision, 2026-10-26.
- **Render: `flagflow-demo-api`.** The demo customer's backend.
- **Vercel: `apps/demo-web`.** The demo customer's app.

Postgres and Redis are Render's managed Postgres and Key Value, all declared in [`render.yaml`](render.yaml).

The steps below use Render's and Vercel's free plans:

- Free web services sleep after about 15 minutes without traffic. The first request after that takes up to a minute.
- Free Postgres expires after 30 days.
- Free Key Value has no persistence: a restart signs everyone out.

That is fine for a demo. Use paid plans for anything real.

## 1. Email (Brevo)

Invites go out through an email provider's HTTPS API. Render's free plan blocks outbound SMTP (ports 25, 465 and 587, and 2465 was unreachable too), so SMTP isn't used there.

Brevo delivers to any recipient once you verify a single sender address, so you don't need a domain:

1. Create a free Brevo account.
2. Go to **Senders, domains & dedicated IPs → Senders → Add a sender**. Add the address invites should come from, e.g. your Gmail, then click the link Brevo emails to it.
3. Go to **SMTP & API → API keys → Generate a new API key**. The key starts with `xkeysib-`.
4. In Render, on `flagflow`, set:
   - `BREVO_API_KEY` to that key.
   - `MAIL_FROM` to `FlagFlow <the address you verified>`.

Invites sent "from" a Gmail address through Brevo may land in spam, because Gmail's own records don't vouch for Brevo. A domain of your own fixes that later.

Resend still works as well, via `RESEND_API_KEY`. Without a verified domain, though, it only delivers to its own account address. If both keys are set, Brevo is used.

## 2. Render (API, dashboard, demo backend, Postgres, Redis)

1. In Render, choose **New → Blueprint** and connect the GitHub repository. Pick the branch to deploy from (`main`, or the branch you are testing). Render reads `render.yaml`.
2. When Render asks for the values marked `sync: false`, enter these:

   | Service             | Key                | Value                                                              |
   | ------------------- | ------------------ | ------------------------------------------------------------------ |
   | `flagflow`          | `BREVO_API_KEY`    | The Brevo API key from step 1 (`xkeysib-…`)                        |
   | `flagflow`          | `MAIL_FROM`        | `FlagFlow <the sender you verified in Brevo>`                      |
   | `flagflow`          | `SUPERADMIN_EMAIL` | Your email (the platform superadmin login)                         |
   | `flagflow-demo-api` | `FLAGFLOW_URL`     | The `flagflow` service's URL, e.g. `https://flagflow.onrender.com` |
   | `flagflow-demo-api` | `FLAGFLOW_API_KEY` | Leave empty for now (step 4)                                       |
   | `flagflow-demo-api` | `DEMO_WEB_ORIGIN`  | Leave empty for now (step 3)                                       |

   Render generates the passwords and the JWT secret. Find them under each service's **Environment** tab: `SUPERADMIN_PASSWORD`, and `DEMO_ADMIN_PASSWORD` for the Acme demo admin `admin@acme.test`.

3. Wait for `flagflow` to go live, then open its URL. You should see the home page. Every start runs the database migrations and the seed: the superadmin, plus the Acme org with its six flags.

## 3. Vercel (demo-web)

1. In Vercel, choose **Add New → Project** and import the same repository.
2. Set **Root Directory** to `apps/demo-web`. `apps/demo-web/vercel.json` supplies the install and build commands.
3. Add the environment variables below, then deploy.

   | Key                  | Value                                                                      |
   | -------------------- | -------------------------------------------------------------------------- |
   | `VITE_DEMO_API_URL`  | The `flagflow-demo-api` URL, e.g. `https://flagflow-demo-api.onrender.com` |
   | `VITE_DASHBOARD_URL` | The `flagflow` URL                                                         |

4. Copy the deployment's URL into `DEMO_WEB_ORIGIN` on `flagflow-demo-api` in Render, and into `VITE_DEMO_URL` on `flagflow` (the home page's Demo links), then redeploy `flagflow` so the dashboard is rebuilt with it.

## 4. Connect the demo

1. Log in to the deployed dashboard as `admin@acme.test` with `DEMO_ADMIN_PASSWORD`.
2. Open **Settings → API keys → New key** and name it "Demo app".
3. Copy the key into `FLAGFLOW_API_KEY` on `flagflow-demo-api`. Render redeploys it.
4. Open the Vercel URL. The panel should show **Live**. Toggle `dark_mode` in the dashboard, and U001's demo app turns dark within a second.

## 5. Check the deployment

Run these from the repository, with the `flagflow` URL in place of `<url>`:

```bash
npm run postman:smoke -- --env-var "baseUrl=<url>"
```

```bash
E2E_BASE_URL=<url> npx playwright test e2e/auth.spec.ts e2e/links.spec.ts --project desktop
```

The smoke collection registers a throwaway org and checks the API contract end to end. The Playwright run checks sign-up, login, silent refresh and every internal link against the production build.
