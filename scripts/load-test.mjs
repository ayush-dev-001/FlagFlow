// Load test for GET /v1/flags/evaluate (PLAN.md phase 9), via `postman performance run`.
//
//   node scripts/load-test.mjs [--base http://localhost:4000] [--vus 50] [--minutes 2] [--profile ramp-up]
//                              [--p95 100] [--max-errors 1]
//
// Registers a fresh org on the target, seeds six flags (some listed users, some all users), writes its API
// key to a temporary Postman environment outside the repo, runs the "FlagFlow Load" collection, and removes
// the environment afterwards. The key is never printed.
//
// The public API allows 600 requests a minute per key. To measure the server rather than the rate limiter,
// point --base at an instance started with RATE_LIMIT_SCALE (not allowed in production). Against normal
// limits, expect 429s once a single key goes past 10 requests a second; the run reports them separately.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []),
);
const base = (args.base ?? 'http://localhost:4000').replace(/\/+$/, '');
const vus = args.vus ?? '50';
const minutes = args.minutes ?? '2';
const profile = args.profile ?? 'ramp-up';
const p95 = args.p95 ?? '100';
const maxErrors = args['max-errors'] ?? '1';

async function call(path, body, token) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${json?.error?.message ?? ''}`);
  return json;
}

const id = `${Date.now()}`;
const org = await call('/api/auth/register', {
  name: 'Load Test',
  email: `load-${id}@example.test`,
  password: 'load-test-password-1',
  organizationName: `Load ${id}`,
});
const flags = [
  ['dark_mode', false, ['U001', 'U002', 'U003']],
  ['chat_widget', true, []],
  ['analytics_dashboard', false, ['U004']],
  ['new_checkout', false, ['U005', 'U006', 'U007', 'U008']],
  ['beta_banner', true, []],
  ['export_report', false, []],
];
for (const [key, targetAll, targets] of flags) {
  const { flag } = await call('/api/flags', { key, targetAll, targets }, org.accessToken);
  if (key !== 'export_report') await call(`/api/flags/${flag.id}/toggle`, {}, org.accessToken);
}

const dir = mkdtempSync(join(tmpdir(), 'flagflow-load-'));
const envFile = join(dir, 'Load.environment.yaml');
writeFileSync(
  envFile,
  [
    'name: Load',
    'values:',
    '  - key: baseUrl',
    `    value: '${base}'`,
    '    enabled: true',
    '    type: default',
    '  - key: apiKey',
    `    value: '${org.apiKey.key}'`,
    '    enabled: true',
    '    type: secret',
    '',
  ].join('\n'),
);

console.log(
  `Target ${base}: ${profile}, ${vus} VUs, ${minutes} min, pass if p95 < ${p95} ms and errors < ${maxErrors}%`,
);
// On Windows the CLI is a .cmd shim, which Node only starts through a shell: quote each argument for it.
const win = process.platform === 'win32';
const quote = (arg) => (win ? `"${arg}"` : arg);
const run = spawn(
  'postman',
  [
    'performance',
    'run',
    'postman/collections/FlagFlow Load',
    '-e',
    envFile,
    '--runner',
    'local',
    '--load-profile',
    profile,
    '--peak-vu',
    vus,
    '--duration',
    minutes,
    '--output',
    'ndjson',
    '--pass-if',
    `less_than(p95, ${p95})`,
    '--pass-if',
    `less_than(error_rate, ${maxErrors})`,
  ].map(quote),
  { shell: win, stdio: ['ignore', 'pipe', 'inherit'] },
);

let summary = null;
let lastLine = '';
run.stdout.on('data', (chunk) => {
  for (const line of String(chunk).split('\n')) {
    if (!line.trim()) continue;
    lastLine = line;
    try {
      const event = JSON.parse(line);
      if (event.type === 'summary' || event.event === 'summary') summary = event;
    } catch {
      // not JSON: progress text
    }
  }
});

const code = await new Promise((resolve) => run.on('close', resolve));
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify(summary ?? lastLine, null, 2));
process.exit(code ?? 1);
