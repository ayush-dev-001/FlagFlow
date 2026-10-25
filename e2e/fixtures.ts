import { test as base, expect, type Page } from '@playwright/test';

/** A fresh account per test, so specs never depend on each other. */
export function newAccount() {
  const id = `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  return {
    org: `Acme ${id.slice(-5)}`,
    name: 'Ada Admin',
    email: `ada-${id}@example.test`,
    password: 'correct-horse-battery',
  };
}

export type Account = ReturnType<typeof newAccount>;

/**
 * Fails a test on any console error or uncaught exception, except failed-request lines a test
 * explicitly expects (e.g. the 401 from a deliberately wrong password).
 */
export const test = base.extend<{ consoleErrors: { allow: (pattern: RegExp) => void } }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      const allowed: RegExp[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
      await use({ allow: (p) => allowed.push(p) });
      const unexpected = errors.filter((e) => !allowed.some((p) => p.test(e)));
      expect(unexpected, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function register(page: Page, account: Account) {
  await page.goto('/register');
  await page.getByLabel('Organization name').fill(account.org);
  await page.getByLabel('Your name').fill(account.name);
  await page.getByLabel('Work email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

/** Opens the navigation on narrow screens, where the sidebar becomes a drawer. */
export async function openNav(page: Page) {
  // Wait for the shell first: right after a navigation the page may still be one without it (e.g. /welcome).
  const menu = page.getByRole('button', { name: 'Open navigation' });
  const sidebar = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await expect(menu.or(sidebar).first()).toBeVisible();
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('navigation', { name: 'Main' }).filter({ visible: true })).toBeVisible();
}
