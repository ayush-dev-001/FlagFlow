// Creates each app's .env from its .env.example, generating local secrets.
// An existing .env is never overwritten: only keys it is missing are appended.
import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const generated = {
  JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64url'),
  SUPERADMIN_EMAIL: () => 'admin@flagflow.local',
  SUPERADMIN_PASSWORD: () => randomBytes(18).toString('base64url'),
  DEMO_ADMIN_EMAIL: () => 'admin@acme.test',
  DEMO_ADMIN_PASSWORD: () => randomBytes(18).toString('base64url'),
};

const fill = (line) =>
  line.replace(/^(\w+)=$/, (l, key) => (generated[key] ? `${key}=${generated[key]()}` : l));
const keyOf = (line) => /^(\w+)=/.exec(line)?.[1];

for (const app of ['api', 'dashboard', 'demo-api', 'demo-web']) {
  const example = join(root, 'apps', app, '.env.example');
  const target = join(root, 'apps', app, '.env');
  if (!existsSync(example)) continue;
  const exampleLines = readFileSync(example, 'utf8').split('\n');

  if (!existsSync(target)) {
    writeFileSync(target, exampleLines.map(fill).join('\n'));
    console.log(`apps/${app}/.env created`);
    continue;
  }

  const present = new Set(readFileSync(target, 'utf8').split('\n').map(keyOf).filter(Boolean));
  const missing = exampleLines.filter((l) => keyOf(l) && !present.has(keyOf(l)));
  if (missing.length === 0) {
    console.log(`apps/${app}/.env up to date`);
    continue;
  }
  appendFileSync(target, `\n${missing.map(fill).join('\n')}\n`);
  console.log(`apps/${app}/.env: added ${missing.map(keyOf).join(', ')}`);
}
