// `npm run security`: dependency audit, secret scan, static analysis, the attack suite and a ZAP API scan
// (PLAN.md §6.4).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
        RATE_LIMIT_SCALE: '100',
      },
    },
  );
  let apiExit = null;
  api.on('exit', (code, signal) => {
    apiExit = { code, signal };
  });
  try {
    if (!(await waitForHealth(`http://localhost:${ZAP_PORT}/api/health`))) {
      console.error('API did not become healthy on the test database');
      return false;
    }
    const out = join(root, '.zap');
    mkdirSync(out, { recursive: true });
    const local = `http://localhost:${ZAP_PORT}`;
    const target = `http://host.docker.internal:${ZAP_PORT}`;

    // Scan as a real org admin, so routes behind auth get attacked too, not just their 401s.
    const reg = await fetch(`${local}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'ZAP Scanner',
        email: `zap-${Date.now()}@example.test`,
        password: randomBytes(18).toString('base64url'),
        organizationName: 'ZAP Scan Org',
      }),
    });
    if (reg.status !== 201) {
      console.error(`could not register the scan account: ${reg.status}`);
      return false;
    }
    const { accessToken, apiKey } = await reg.json();
    const { key: scanKey } = apiKey;

    // Two passes, because ZAP sends one auth header per run: the dashboard API with the admin's bearer
    // token, then /v1 with the org's API key. Logout would revoke the scan token mid-scan, and /v1/stream
    // never ends (ZAP would hang on it), so both stay out of the specs; the attack suite covers them.
    const spec = await (await fetch(`${local}/api/docs`)).json();
    const only = (keep) => ({
      ...spec,
      paths: Object.fromEntries(Object.entries(spec.paths).filter(([path]) => keep(path))),
    });
    writeFileSync(
      join(out, 'openapi-dashboard.json'),
      JSON.stringify(only((p) => p.startsWith('/api/') && p !== '/api/auth/logout')),
    );
    writeFileSync(
      join(out, 'openapi-public.json'),
      JSON.stringify(only((p) => p.startsWith('/v1/') && p !== '/v1/stream')),
    );

    // Fail fast if containers can't reach the host API; otherwise ZAP retries for hours and reports nothing.
    const reach = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--entrypoint',
        'python3',
        ZAP,
        '-c',
        `import urllib.request; urllib.request.urlopen('${target}/api/health', timeout=10)`,
      ],
      { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
    );
    if (reach.status !== 0) {
      console.error(`ZAP's container cannot reach the API at ${target}; check Docker Desktop's networking`);
      return false;
    }

    const passes = [
      { name: 'dashboard', header: 'Authorization', value: `Bearer ${accessToken}` },
      { name: 'public', header: 'x-api-key', value: scanKey },
    ];
    const alerts = [];
    for (const pass of passes) {
      console.log(`\n  ZAP pass: ${pass.name}`);
      // ZAP's packaged scans add this header to every request. (A `-z` replacer rule doesn't work here:
      // ZAP splits the option string on spaces, which cuts "Bearer <token>" in two.)
      const r = spawnSync(
        'docker',
        [
          'run',
          '--rm',
          '-e',
          `ZAP_AUTH_HEADER=${pass.header}`,
          '-e',
          `ZAP_AUTH_HEADER_VALUE=${pass.value}`,
          '-v',
          `${out}:/zap/wrk:rw`,
          ZAP,
          'zap-api-scan.py',
          '-t',
          `/zap/wrk/openapi-${pass.name}.json`,
          '-f',
          'openapi',
          '-O',
          target,
          // Cap each active scan so the gate stays usable and well inside the 15-minute access token.
          '-z',
          '-config scanner.maxScanDurationInMins=4 -config scanner.maxRuleDurationInMins=1',
          '-J',
          `zap-${pass.name}.json`,
          '-r',
          `zap-${pass.name}.html`,
          '-I',
        ],
        { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
      );
      if (r.status !== 0) {
        console.error(`zap-api-scan (${pass.name}) exited with ${r.status}`);
        return false;
      }
      if (apiExit) {
        console.error(`the API process died during the ${pass.name} scan: ${JSON.stringify(apiExit)}`);
        return false;
      }
      const report = JSON.parse(readFileSync(join(out, `zap-${pass.name}.json`), 'utf8'));
      alerts.push(...report.site.flatMap((s) => s.alerts.map((a) => ({ ...a, pass: pass.name }))));
    }

    // Prove both scans were authenticated: the credentials must still work afterwards.
    const probes = [
      ['/api/team/members', { authorization: `Bearer ${accessToken}` }],
      ['/v1/snapshot', { 'x-api-key': scanKey }],
    ];
    for (const [path, headers] of probes) {
      let status;
      for (let attempt = 1; attempt <= 3 && status === undefined; attempt++) {
        try {
          status = (await fetch(`${local}${path}`, { headers: { ...headers, connection: 'close' } })).status;
        } catch (err) {
          console.error(`post-scan probe of ${path}, attempt ${attempt}, failed: ${err.cause?.code ?? err}`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (status !== 200) {
        console.error(
          `post-scan probe of ${path} got ${status ?? 'no response'}; that pass was not authenticated`,
        );
        return false;
      }
    }

    const byRisk = Object.groupBy(alerts, (a) => a.riskdesc.split(' ')[0]);
    console.log(
      `ZAP alerts: ${
        Object.entries(byRisk)
          .map(([risk, list]) => `${risk} ${list.length}`)
          .join(', ') || 'none'
      }`,
    );
    for (const a of alerts) {
      console.log(`  [${a.pass}] [${a.riskdesc}] ${a.name} (${a.instances.length} instance(s))`);
    }
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
