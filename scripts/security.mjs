// `npm run security`: dependency audit, secret scan, static analysis, the attack suite and a ZAP API scan
// (PLAN.md §6.4).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const GITLEAKS = 'zricethezav/gitleaks:v8.24.2';
const SEMGREP = 'semgrep/semgrep:1.180.0';
const ZAP = 'zaproxy/zap-stable:20261008';
const ZAP_PORT = 4010;
const win = process.platform === 'win32';

const steps = [
  ['npm audit (high/critical)', 'npm', ['audit', '--audit-level=high']],
  [
    'gitleaks (working tree)',
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${root}:/repo`,
      GITLEAKS,
      'dir',
      '/repo',
      '--no-banner',
      '--redact',
      '--exit-code',
      '1',
    ],
  ],
  [
    'semgrep (OWASP + Node/TypeScript)',
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${root}:/src`,
      '-w',
      '/src',
      SEMGREP,
      'semgrep',
      'scan',
      '--config',
      'p/owasp-top-ten',
      '--config',
      'p/nodejs',
      '--config',
      'p/typescript',
      '--severity',
      'ERROR',
      '--error',
      '--metrics',
      'off',
      '--quiet',
    ],
  ],
  ['attack suite', 'npx', ['vitest', 'run', '--config', 'security/vitest.config.ts']],
];

try {
  execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { stdio: 'ignore' });
} catch {
  console.error('Docker is not running: gitleaks and semgrep need it. Start Docker Desktop and retry.');
  process.exit(1);
}

const failed = [];
for (const [name, cmd, args] of steps) {
  console.log(`\n▶ ${name}`);
  // MSYS_NO_PATHCONV stops Git Bash from rewriting container paths like /src when this runs under it.
  // npm/npx are .cmd shims on Windows and need a shell; pass one command string so nothing is re-split.
  const shell = win && cmd !== 'docker';
  const opts = { cwd: root, stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } };
  const r = shell ? spawnSync([cmd, ...args].join(' '), { ...opts, shell }) : spawnSync(cmd, args, opts);
  if (r.status !== 0) failed.push(name);
}

console.log('\n▶ OWASP ZAP API scan');
if (!(await zapScan())) failed.push('ZAP API scan');

console.log(failed.length ? `\n✖ failed: ${failed.join(', ')}` : '\n✔ all security checks passed');
process.exit(failed.length ? 1 : 0);

/**
 * Boots the API on the test database, points ZAP's API scan at the generated OpenAPI spec, and fails on any
 * High-risk alert. Reports land in .zap/ (gitignored).
 */
async function zapScan() {
  const api = spawn(
    process.execPath,
    [join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/api/src/index.ts'],
    {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        PORT: String(ZAP_PORT),
        DATABASE_URL: 'postgresql://flagflow:flagflow@localhost:5432/flagflow_test',
        REDIS_URL: 'redis://localhost:6379/2',
        JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
        DASHBOARD_ORIGIN: 'http://localhost:5173',
        SMTP_URL: 'smtp://localhost:1025',
        MAIL_FROM: 'FlagFlow <no-reply@flagflow.local>',
      },
    },
  );
  try {
    if (!(await waitForHealth(`http://localhost:${ZAP_PORT}/api/health`))) {
      console.error('API did not become healthy on the test database');
      return false;
    }
    const out = join(root, '.zap');
    mkdirSync(out, { recursive: true });
    const target = `http://host.docker.internal:${ZAP_PORT}`;
    const r = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${out}:/zap/wrk:rw`,
        ZAP,
        'zap-api-scan.py',
        '-t',
        `${target}/api/docs`,
        '-f',
        'openapi',
        '-O',
        target,
        '-J',
        'zap-report.json',
        '-r',
        'zap-report.html',
        '-I',
      ],
      { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
    );
    if (r.status !== 0) {
      console.error(`zap-api-scan exited with ${r.status}`);
      return false;
    }
    const report = JSON.parse(readFileSync(join(out, 'zap-report.json'), 'utf8'));
    const alerts = report.site.flatMap((s) => s.alerts);
    const byRisk = Object.groupBy(alerts, (a) => a.riskdesc.split(' ')[0]);
    console.log(
      `ZAP alerts: ${
        Object.entries(byRisk)
          .map(([risk, list]) => `${risk} ${list.length}`)
          .join(', ') || 'none'
      }`,
    );
    for (const a of alerts) console.log(`  [${a.riskdesc}] ${a.name} (${a.instances.length} instance(s))`);
    return !alerts.some((a) => a.riskcode === '3');
  } finally {
    api.kill();
  }
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
