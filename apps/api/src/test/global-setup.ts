import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { TEST_DATABASE_URL } from './helpers.js';

/** Applies migrations to the test database once per run. */
export default function setup() {
  try {
    execSync('npx prisma migrate deploy', {
      cwd: join(import.meta.dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (err) {
    const out = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `prisma migrate deploy failed for the test database. Is \`docker compose up -d\` running?\n${String(out.stdout ?? '')}${String(out.stderr ?? '')}`,
      { cause: err },
    );
  }
}
