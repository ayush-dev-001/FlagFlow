import type { Page } from '@playwright/test';
import { newAccount, register, test, expect } from './fixtures';

// linkinator only sees the static HTML of a single-page app, so this crawls the rendered screens:
// every internal link on every reachable screen must open a real page, not the 404 screen.

async function internalLinks(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  const origin = new URL(page.url()).origin;
  return [...new Set(hrefs.filter((h) => h.startsWith(origin)).map((h) => new URL(h).pathname))];
}

async function crawl(page: Page, start: string[]) {
  const seen = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const path = queue.shift()!;
    if (seen.has(path)) continue;
    seen.add(path);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Page Not Found' }), `${path} is a 404`).toHaveCount(0);
    for (const next of await internalLinks(page)) if (!seen.has(next)) queue.push(next);
  }
  return seen;
}

test('every internal link a guest can reach resolves', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'links are the same at every width');
  const seen = await crawl(page, ['/login', '/register']);
  expect([...seen]).toEqual(expect.arrayContaining(['/login', '/register']));
});

test('every internal link a signed-in admin can reach resolves', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'links are the same at every width');
  await register(page, newAccount());
  await page.getByLabel("I've stored this key somewhere safe").check();
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await expect(page).toHaveURL(/\/flags$/);
  const seen = await crawl(page, ['/flags']);
  expect([...seen]).toEqual(expect.arrayContaining(['/flags', '/end-users', '/team', '/audit', '/settings']));
});
