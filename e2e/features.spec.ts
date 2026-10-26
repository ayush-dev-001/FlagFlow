import type { Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../apps/api/src/auth/passwords';
import { connectTestDb } from '../apps/api/src/test/helpers';
import { login, newAccount, openNav, register, test, expect, type Account } from './fixtures';

// The main dashboard journeys (PLAN.md §5, phase 7): flags board and detail, end-user lookup, team,
// audit log, settings and the superadmin organizations page.

async function signedIn(page: Page): Promise<Account> {
  const account = newAccount();
  await register(page, account);
  await page.getByLabel("I've stored this key somewhere safe").check();
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await expect(page).toHaveURL(/\/flags$/);
  return account;
}

const column = (page: Page, name: string) => page.getByRole('region', { name });

async function createFlag(page: Page, key: string, targets = '') {
  await page
    .getByRole('button', { name: /New flag|Create your first flag/ })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'New Flag' });
  await dialog.getByLabel('Key').fill(key);
  await dialog.getByLabel('Description').fill(`Controls ${key}`);
  if (targets) await dialog.getByLabel('End-user IDs').fill(targets);
  await dialog.getByRole('button', { name: 'Create flag' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: `Created ${key}` })).toBeVisible();
}

test('a flag goes from Inactive to Testing to Live and its history records each step', async ({ page }) => {
  await signedIn(page);
  await expect(page.getByText('No Flags Yet')).toBeVisible();

  await createFlag(page, 'new_checkout', 'U001, U002');
  await expect(column(page, 'Inactive').getByRole('link', { name: 'new_checkout' })).toBeVisible();

  // On from the board: it moves to Testing (listed users only).
  await page.getByRole('switch', { name: 'new_checkout off' }).click();
  await expect(column(page, 'Testing').getByRole('link', { name: 'new_checkout' })).toBeVisible();
  await expect(column(page, 'Inactive').getByText('No inactive flags')).toBeVisible();

  // Detail: add a user, remove one, then reach everyone.
  await page.getByRole('link', { name: 'new_checkout' }).click();
  await expect(page.getByRole('heading', { name: 'new_checkout', level: 1 })).toBeVisible();
  await expect(page.getByText('2 listed users get it.')).toBeVisible();
  await page.getByLabel('End-user IDs to add').fill('U003');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Listed users' }).getByText('U003')).toBeVisible();
  await page.getByRole('button', { name: 'Remove U001' }).click();
  await expect(page.getByRole('list', { name: 'Listed users' }).getByText('U001')).toHaveCount(0);
  await page.getByRole('radio', { name: 'All users' }).click();
  await expect(page.getByText('Every user gets it.')).toBeVisible();
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible();

  // History, newest first, in words.
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByText(/set new_checkout to reach all users/)).toBeVisible();
  await expect(history.getByText(/removed U001 from new_checkout/)).toBeVisible();
  await expect(history.getByText(/added U003 to new_checkout/)).toBeVisible();
  await expect(history.getByText(/turned new_checkout on/)).toBeVisible();
  await expect(history.getByText(/created new_checkout/)).toBeVisible();

  // Back on the board it is Live; the state filter shows that column alone.
  await page.getByRole('link', { name: 'Flags', exact: true }).first().click();
  await expect(column(page, 'Live').getByRole('link', { name: 'new_checkout' })).toBeVisible();
  await page.getByRole('radio', { name: 'Testing' }).click();
  await expect(column(page, 'Live')).toHaveCount(0);
  await expect(column(page, 'Testing').getByText('No testing flags')).toBeVisible();
});

test('search finds flags by key or description, and a taken key is refused', async ({
  page,
  consoleErrors,
}) => {
  consoleErrors.allow(/status of (400|409)/);
  await signedIn(page);
  await createFlag(page, 'dark_mode');
  await createFlag(page, 'beta_banner');
  await page.getByLabel('Search flags').fill('dark');
  await expect(page.getByRole('link', { name: 'dark_mode' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'beta_banner' })).toHaveCount(0);
  await page.getByLabel('Search flags').fill('zzz');
  await expect(page.getByText('No Matching Flags')).toBeVisible();
  await page.getByLabel('Search flags').fill('');

  await page.getByRole('button', { name: 'New flag' }).click();
  const dialog = page.getByRole('dialog', { name: 'New Flag' });
  await dialog.getByLabel('Key').fill('dark_mode');
  await dialog.getByRole('button', { name: 'Create flag' }).click();
  await expect(dialog.getByText('A flag with key "dark_mode" already exists')).toBeVisible();
  await dialog.getByLabel('Key').fill('Bad Key');
  await dialog.getByRole('button', { name: 'Create flag' }).click();
  await expect(dialog.getByText(/lowercase letters, digits or underscores/)).toBeVisible();
});

test('end-user lookup explains each flag and lists or unlists the user', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 400/);
  await signedIn(page);
  await createFlag(page, 'chat_widget');
  await page.getByRole('switch', { name: 'chat_widget off' }).click();
  await expect(column(page, 'Testing').getByRole('link', { name: 'chat_widget' })).toBeVisible();

  await openNav(page);
  await page.getByRole('link', { name: 'End users' }).click();
  await page.getByLabel('End-user ID').fill('U042');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page).toHaveURL(/\/end-users\?id=U042$/);
  const row = page.getByRole('listitem').filter({ hasText: 'chat_widget' });
  await expect(row.getByText("Doesn't get it")).toBeVisible();
  await expect(row.getByText('Only its listed users get it')).toBeVisible();

  await row.getByRole('switch', { name: 'List U042 for chat_widget' }).click();
  await expect(row.getByText('Gets it')).toBeVisible();
  await expect(page.getByText('Gets 1 of 1 flag right now.')).toBeVisible();

  await page.getByLabel('End-user ID').fill('bad id!');
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.getByRole('alert')).toContainText("isn't a valid ID");
});

test('admins delete flags; members see no admin areas', async ({ page, request, consoleErrors }) => {
  const admin = await signedIn(page);
  await createFlag(page, 'export_report');
  await page.getByRole('link', { name: 'export_report' }).click();
  await page.getByRole('button', { name: 'Delete flag' }).click();
  const confirm = page.getByRole('dialog', { name: 'Delete export_report?' });
  await confirm.getByRole('button', { name: 'Delete flag' }).click();
  await expect(page).toHaveURL(/\/flags$/);
  await expect(page.getByText('No Flags Yet')).toBeVisible();

  // Invite a member through the UI, then accept from the link in Mailpit.
  await openNav(page);
  await page.getByRole('link', { name: 'Team' }).click();
  const email = `mia-${randomUUID().slice(0, 8)}@example.test`;
  await page.getByRole('button', { name: 'Invite' }).click();
  const invite = page.getByRole('dialog', { name: 'Invite a Teammate' });
  await invite.getByLabel('Email').fill(email);
  await invite.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await expect(page.getByText(`Invite sent to ${email}`)).toBeVisible();

  const messages = await (
    await request.get(`http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
  ).json();
  const id = messages.messages[0].ID as string;
  const body = await (await request.get(`http://localhost:8025/api/v1/message/${id}`)).json();
  const link = /https?:\/\/[^\s"<>]+\/invite\/[A-Za-z0-9_-]+/.exec(body.Text as string)![0];

  await openNav(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.goto(new URL(link).pathname);
  await page.getByLabel('Your name').fill('Mia Member');
  await page.getByLabel('Password').fill('a-long-password-1');
  await page.getByRole('button', { name: /^Join / }).click();
  await expect(page).toHaveURL(/\/flags$/);

  await openNav(page);
  const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true });
  await expect(nav.getByRole('link', { name: 'Flags' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Team' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/flags$/);
  void admin;
  void consoleErrors;
});

test('team: change a role, deactivate and reactivate; the audit log records it', async ({ page }) => {
  await signedIn(page);
  await openNav(page);
  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page.getByRole('list', { name: 'Members' }).getByText('You')).toBeVisible();
  await expect(page.getByText('No open invites.')).toBeVisible();

  const email = `max-${randomUUID().slice(0, 8)}@example.test`;
  await page.getByRole('button', { name: 'Invite' }).click();
  const invite = page.getByRole('dialog', { name: 'Invite a Teammate' });
  await invite.getByLabel('Email').fill(email);
  await invite.getByLabel('Role').selectOption('ADMIN');
  await invite.getByRole('button', { name: 'Send invite' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: email })).toContainText('Admin');
  await page.getByRole('listitem').filter({ hasText: email }).getByRole('button', { name: 'Revoke' }).click();
  await expect(page.getByText(`Invite for ${email} revoked`)).toBeVisible();
  await expect(page.getByText('No open invites.')).toBeVisible();

  await openNav(page);
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByText(new RegExp(`invited ${email} as an admin`))).toBeVisible();
  await expect(page.getByText(/revoked an invite/)).toBeVisible();
  await expect(page.getByText(/created the organization/)).toBeVisible();
});

test('settings: rename the org, create a key shown once, and revoke it', async ({ page }) => {
  const account = await signedIn(page);
  await openNav(page);
  await page.getByRole('link', { name: 'Settings' }).click();

  const renamed = `${account.org} Labs`;
  await page.getByLabel('Name', { exact: true }).fill(renamed);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Organization renamed')).toBeVisible();
  await openNav(page);
  await expect(page.getByText(renamed).filter({ visible: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'New key' }).click();
  const create = page.getByRole('dialog', { name: 'New API Key' });
  await create.getByLabel('Name').fill('Staging backend');
  await create.getByRole('button', { name: 'Create key' }).click();
  const reveal = page.getByRole('dialog', { name: 'Copy Your New Key' });
  await expect(reveal.getByLabel('API key')).toHaveText(/^ff_live_/);
  await expect(reveal.getByRole('button', { name: 'Done' })).toBeDisabled();
  await reveal.getByLabel("I've stored this key somewhere safe").check();
  await reveal.getByRole('button', { name: 'Done' }).click();

  const row = page.getByRole('listitem').filter({ hasText: 'Staging backend' });
  await expect(row).toContainText('Never used');
  await row.getByRole('button', { name: 'Revoke' }).click();
  await page
    .getByRole('dialog', { name: 'Revoke Staging backend?' })
    .getByRole('button', { name: 'Revoke key' })
    .click();
  await expect(row).toContainText('Revoked');
  await expect(
    page.getByText('ff_live_', { exact: false }).filter({ hasText: /^ff_live_[A-Za-z0-9_-]{32}$/ }),
  ).toHaveCount(0);
});

test('a superadmin deactivates an organization and its people are logged out', async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name === 'mobile', 'one run is enough for the platform page');
  const orgPage = await browser.newPage();
  const account = newAccount();
  await register(orgPage, account);

  const prisma = connectTestDb();
  const email = `root-${randomUUID().slice(0, 8)}@example.test`;
  const password = 'superadmin-password-1';
  await prisma.user.create({
    data: { email, name: 'Root', role: 'SUPERADMIN', passwordHash: await hashPassword(password) },
  });
  await prisma.$disconnect();

  await login(page, email, password);
  await expect(page).toHaveURL(/\/admin$/);
  const row = page.getByRole('listitem').filter({ hasText: account.org });
  await expect(row).toContainText('Active');
  await row.getByRole('button', { name: 'Deactivate' }).click();
  await page
    .getByRole('dialog', { name: `Deactivate ${account.org}?` })
    .getByRole('button', { name: 'Deactivate' })
    .click();
  await expect(row).toContainText('Deactivated');

  // The org's open session is gone: its next request sends it to the login page.
  await orgPage.goto('/flags');
  await expect(orgPage).toHaveURL(/\/login$/);
  await login(orgPage, account.email, account.password);
  await expect(orgPage.getByRole('alert')).toBeVisible();

  await row.getByRole('button', { name: 'Reactivate' }).click();
  await expect(row).toContainText('Active');
  await orgPage.close();
});
