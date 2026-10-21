// `npm run security`: dependency audit, secret scan, static analysis and the attack suite (PLAN.md §6.4).
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const GITLEAKS = 'zricethezav/gitleaks:v8.24.2';
const SEMGREP = 'semgrep/semgrep:1.180.0';
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

console.log(failed.length ? `\n✖ failed: ${failed.join(', ')}` : '\n✔ all security checks passed');
process.exit(failed.length ? 1 : 0);
