// Creates each app's .env from its .env.example, generating local secrets. Never overwrites an existing .env.
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const generated = {
  JWT_ACCESS_SECRET: () => randomBytes(48).toString('base64url'),
  SUPERADMIN_EMAIL: () => 'admin@flagflow.local',
  SUPERADMIN_PASSWORD: () => randomBytes(18).toString('base64url'),
};

for (const app of ['api', 'dashboard', 'demo-api', 'demo-web']) {
  const example = join(root, 'apps', app, '.env.example');
  const target = join(root, 'apps', app, '.env');
  if (!existsSync(example)) continue;
  if (existsSync(target)) {
    console.log(`apps/${app}/.env exists, left unchanged`);
    continue;
  }
  copyFileSync(example, target);
  const filled = readFileSync(target, 'utf8').replace(/^(\w+)=$/gm, (line, key) =>
    generated[key] ? `${key}=${generated[key]()}` : line,
  );
  writeFileSync(target, filled);
  console.log(`apps/${app}/.env created`);
}
