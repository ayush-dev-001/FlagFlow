// Captures real screenshots of FlagFlow for the video, with `npm run dev` running in the repo root.
// Signs in as the seeded demo admin, turns dark_mode off, then on, and measures how long U001's
// demo app takes to change. Writes public/shots/*.png and public/shots/capture.json.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
/* global window, document, MutationObserver -- these run inside the page */

const DASH = 'http://localhost:5173';
const DEMO = 'http://localhost:5174';
const out = new URL('../public/shots/', import.meta.url);
await mkdir(out, { recursive: true });

const env = Object.fromEntries(
  (await readFile(new URL('../../apps/api/.env', import.meta.url), 'utf8'))
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, out)) });

const dash = await ctx.newPage();
await dash.goto(DASH);
await dash.waitForLoadState('networkidle');
await shot(dash, 'landing');

await dash.goto(`${DASH}/login`);
await dash.getByLabel('Email').fill(env.DEMO_ADMIN_EMAIL);
await dash.getByLabel('Password').fill(env.DEMO_ADMIN_PASSWORD);
await dash.getByRole('button', { name: 'Log in' }).click();
await dash.waitForURL(/\/flags/);
await dash.waitForLoadState('networkidle');

// Start from off, so the shots show the switch going on.
const on = dash.getByRole('switch', { name: 'dark_mode on' });
if (await on.isVisible()) {
  await on.click();
  await dash.getByRole('switch', { name: 'dark_mode off' }).waitFor();
}

const viewers = {};
for (const user of ['U001', 'U003']) {
  const p = await ctx.newPage();
  await p.goto(`${DEMO}/?user=${user}`);
  await p.getByRole('status').filter({ hasText: 'Live' }).waitFor();
  await p.waitForTimeout(500);
  viewers[user] = p;
}
await dash.bringToFront();
await dash.mouse.move(0, 0);
await shot(dash, 'board-off');
await shot(viewers.U001, 'demo-u001-light');
await shot(viewers.U003, 'demo-u003-before');

// The live moment: click, then time U001's theme change from the demo app's own clock.
await viewers.U001.evaluate(() => {
  window.__changed = new Promise((resolve) => {
    const el = document.querySelector('[data-theme]');
    new MutationObserver(() => el.dataset.theme === 'dark' && resolve(performance.now())).observe(el, {
      attributes: true,
    });
  });
});
const clickedAt = await viewers.U001.evaluate(() => performance.now());
await dash.getByRole('switch', { name: 'dark_mode off' }).click();
const changedAt = await viewers.U001.evaluate(() => window.__changed);
const latencyMs = Math.round(changedAt - clickedAt);
console.log(`U001 changed ${latencyMs} ms after the click`);

await dash.getByRole('switch', { name: 'dark_mode on' }).waitFor();
await dash.waitForTimeout(400);
await dash.mouse.move(0, 0);
await shot(dash, 'board-on');
await viewers.U001.getByText(/dark_mode\s+turned on for U001/).waitFor();
await viewers.U001.waitForTimeout(600);
await shot(viewers.U001, 'demo-u001-dark');
await viewers.U003.getByText(/dark_mode\s+changed, no effect for U003/).waitFor();
await viewers.U003.waitForTimeout(600);
await shot(viewers.U003, 'demo-u003-after');

await writeFile(
  new URL('capture.json', out),
  JSON.stringify({ latencyMs, capturedAt: new Date().toISOString() }),
);
await browser.close();
