import { type ChildProcess, spawn } from 'node:child_process';
import { API_URL, DEMO_API_PORT, DEMO_WEB_URL } from '../playwright.config';
import { newAccount, register, test, expect } from './fixtures';

// Phase 8 done-when: toggling dark_mode in the dashboard flips U001's demo app live, with no refresh
// and no redeploy. The demo backend is started here with the new org's API key.

let demoApi: ChildProcess | undefined;

test.afterEach(() => {
  demoApi?.kill();
  demoApi = undefined;
});

async function startDemoApi(apiKey: string) {
  demoApi = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/demo-api/src/index.ts'], {
    env: {
      ...process.env,
      PORT: String(DEMO_API_PORT),
      FLAGFLOW_URL: API_URL,
      FLAGFLOW_API_KEY: apiKey,
      DEMO_WEB_ORIGIN: DEMO_WEB_URL,
    },
    stdio: 'ignore',
  });
  // Ready once it holds a live FlagFlow snapshot.
  await expect
    .poll(
      async () => {
        try {
          return (
            (await (await fetch(`http://localhost:${DEMO_API_PORT}/health`)).json()) as { flagflow: string }
          ).flagflow;
        } catch {
          return 'down';
        }
      },
      { timeout: 30_000 },
    )
    .toBe('live');
}

test('toggling dark_mode in the dashboard flips U001’s demo app live, without a reload', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'mobile', 'one run proves the live path; layout is checked below');

  // An org, its one-time key, and dark_mode for U001 only, all through the dashboard.
  // Reduced motion shows the one-time key at once instead of resolving it character by character.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const account = newAccount();
  await register(page, account);
  // The welcome page resolves the key from a mask; wait for the real value.
  const keyField = page.getByLabel('API key');
  await expect(keyField).toHaveText(/^ff_live_[A-Za-z0-9_-]{32}$/);
  const key = (await keyField.textContent())!;
  await page.getByLabel("I've stored this key somewhere safe").check();
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await page.getByRole('button', { name: 'Create your first flag' }).click();
  const dialog = page.getByRole('dialog', { name: 'New Flag' });
  await dialog.getByLabel('Key').fill('dark_mode');
  await dialog.getByLabel('End-user IDs').fill('U001');
  await dialog.getByRole('button', { name: 'Create flag' }).click();
  await expect(dialog).toBeHidden();

  await startDemoApi(key);

  const demo = await context.newPage();
  await demo.goto(`${DEMO_WEB_URL}/?user=U001`);
  // A second viewer on U002, who isn't listed: the same change must do nothing for them.
  const other = await context.newPage();
  await other.goto(`${DEMO_WEB_URL}/?user=U002`);
  const acme = demo.locator('[data-theme]');
  const otherAcme = other.locator('[data-theme]');
  await expect(demo.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  await expect(other.getByRole('status').filter({ hasText: 'Live' })).toBeVisible();
  await expect(acme).toHaveAttribute('data-theme', 'light');
  await expect(otherAcme).toHaveAttribute('data-theme', 'light');
  // A marker that a reload would wipe out.
  await demo.evaluate(() => ((window as unknown as { noReload: boolean }).noReload = true));

  // Turn it on in the dashboard: U001's app goes dark within a second.
  await page.getByRole('switch', { name: 'dark_mode off' }).click();
  await expect(acme).toHaveAttribute('data-theme', 'dark', { timeout: 1_000 });
  await expect(demo.getByText(/dark_mode\s+turned on for U001/)).toBeVisible();
  expect(await demo.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);

  // U002 heard the change but isn't affected, and says so.
  await expect(other.getByText(/dark_mode\s+changed, no effect for U002/)).toBeVisible();
  await expect(otherAcme).toHaveAttribute('data-theme', 'light');

  // Off again from the dashboard turns U001 back to light, still without a reload.
  await page.getByRole('switch', { name: 'dark_mode on' }).click();
  await expect(acme).toHaveAttribute('data-theme', 'light', { timeout: 1_000 });
  expect(await demo.evaluate(() => (window as unknown as { noReload?: boolean }).noReload)).toBe(true);

  // Switching the viewed user never shows the previous user's flags under the new name.
  await page.getByRole('switch', { name: 'dark_mode off' }).click();
  await expect(acme).toHaveAttribute('data-theme', 'dark', { timeout: 1_000 });
  await demo.getByText('U002', { exact: true }).click();
  await expect(acme).toHaveAttribute('data-theme', 'light');
  await expect(demo.getByText('What FlagFlow says for Leo Martins')).toBeVisible();
});

test('the demo explains itself when its backend is down', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/ERR_CONNECTION_REFUSED|EventSource/);
  await page.goto(`${DEMO_WEB_URL}/?user=U003`);
  await expect(page.getByRole('status').filter({ hasText: 'Demo backend offline' })).toBeVisible();
  await expect(page.locator('[data-theme]')).toHaveAttribute('data-theme', 'light');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
