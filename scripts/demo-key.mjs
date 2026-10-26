// Gives the demo app an API key for the seeded Acme org: logs in to the local FlagFlow API as the demo
// admin (from apps/api/.env), creates a key named "Demo app", and writes it to apps/demo-api/.env.
// The key itself is never printed. Run after `npm run db:seed`, with the API running.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const readEnv = (file) =>
  existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((l) => /^\w+=/.test(l))
          .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
      )
    : {};

const apiEnv = readEnv(join(root, 'apps/api/.env'));
const demoEnvFile = join(root, 'apps/demo-api/.env');
const demoEnv = readEnv(demoEnvFile);
const base = (demoEnv.FLAGFLOW_URL || 'http://localhost:4000').replace(/\/+$/, '');

if (!apiEnv.DEMO_ADMIN_EMAIL || !apiEnv.DEMO_ADMIN_PASSWORD) {
  console.error(
    'apps/api/.env has no DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD. Run `npm run setup:env` first.',
  );
  process.exit(1);
}
if (!existsSync(demoEnvFile)) {
  console.error('apps/demo-api/.env is missing. Run `npm run setup:env` first.');
  process.exit(1);
}

async function call(path, init = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${body?.error?.message ?? ''}`.trim());
  return body;
}

try {
  const { accessToken } = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: apiEnv.DEMO_ADMIN_EMAIL, password: apiEnv.DEMO_ADMIN_PASSWORD }),
  });
  const { apiKey } = await call('/org/api-keys', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ name: 'Demo app' }),
  });

  const text = readFileSync(demoEnvFile, 'utf8');
  const next = /^FLAGFLOW_API_KEY=.*$/m.test(text)
    ? text.replace(/^FLAGFLOW_API_KEY=.*$/m, `FLAGFLOW_API_KEY=${apiKey.key}`)
    : `${text.trimEnd()}\nFLAGFLOW_API_KEY=${apiKey.key}\n`;
  writeFileSync(demoEnvFile, next);
  console.log(`Created API key "${apiKey.name}" (${apiKey.prefix}…) and saved it to apps/demo-api/.env.`);
  console.log('Restart demo-api to use it. Revoke older demo keys in Settings → API keys.');
} catch (err) {
  console.error(`Could not create a demo key: ${err.message}. Is the API running at ${base}?`);
  process.exit(1);
}
