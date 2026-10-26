import { mkdirSync } from 'node:fs';
import { newAccount, openNav, register, test, expect } from './fixtures';

// Responsive and keyboard checks, plus the review screenshots (.impeccable/review/) for every screen.

const REVIEW_DIR = '.impeccable/review';

async function noHorizontalScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'horizontal overflow (px)').toBeLessThanOrEqual(0);
}

test('every screen fits the viewport and is captured for review', async ({ page }, info) => {
  mkdirSync(REVIEW_DIR, { recursive: true });
  const tag = info.project.name;
  // Reduced motion still keeps opacity fades, so wait until every animation has finished before capturing:
  // a half-faded element would read as a missing one in review.
  const shot = async (name: string) => {
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running' && a.playState !== 'pending'),
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${REVIEW_DIR}/${tag}-${name}.png`, fullPage: true });
  };

  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Ship Features/ })).toBeVisible();
  await noHorizontalScroll(page);
  await shot('home');

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  await noHorizontalScroll(page);
  await shot('login');

  await page.goto('/register');
  await noHorizontalScroll(page);
  await shot('register');

  const account = newAccount();
  await register(page, account);
  await expect(page.getByLabel('API key')).toHaveText(/^ff_live_/);
  await noHorizontalScroll(page);
  await shot('welcome');

  await page.getByLabel("I've stored this key somewhere safe").check();
  await expect(page.getByRole('button', { name: 'Continue to flags' })).toBeEnabled();
  await shot('welcome-checked');
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await expect(page).toHaveURL(/\/flags$/);
  await noHorizontalScroll(page);
  await shot('flags');

  // Phase 7 screens, with one flag in play so they show real content.
  await page.getByRole('button', { name: 'Create your first flag' }).click();
  const dialog = page.getByRole('dialog', { name: 'New Flag' });
  await shot('flag-new');
  await dialog.getByLabel('Key').fill('new_checkout');
  await dialog.getByLabel('Description').fill('Redesigned checkout');
  await dialog.getByLabel('End-user IDs').fill('U001, U002');
  await dialog.getByRole('button', { name: 'Create flag' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('switch', { name: 'new_checkout off' }).click();
  await expect(
    page.getByRole('region', { name: 'Testing' }).getByRole('link', { name: 'new_checkout' }),
  ).toBeVisible();
  await noHorizontalScroll(page);
  await shot('flags-board');

  await page.getByRole('link', { name: 'new_checkout' }).click();
  await expect(page.getByRole('heading', { name: 'new_checkout', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'History' }).getByText(/turned/)).toBeVisible();
  await noHorizontalScroll(page);
  await shot('flag-detail');

  for (const [path, heading, name] of [
    ['/end-users?id=U001', 'End Users', 'end-users'],
    ['/audit', 'Audit Log', 'audit'],
    ['/settings', 'Settings', 'settings'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Loading|Looking/ })).toHaveCount(0);
    await noHorizontalScroll(page);
    await shot(name);
  }

  await openNav(page);
  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page.getByRole('heading', { name: 'Team', level: 1 })).toBeVisible();
  await noHorizontalScroll(page);
  await expect(page.getByRole('list', { name: 'Members' })).toBeVisible();
  await shot('team');

  if (tag === 'mobile') {
    await openNav(page);
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    await shot('nav-open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  }
});

test('the login form works from the keyboard alone', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').focus();
  await page.keyboard.type('nobody@example.test');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Log in' })).toBeFocused();
});
