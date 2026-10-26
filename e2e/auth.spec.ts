import { login, newAccount, openNav, register, test, expect } from './fixtures';

test('register shows the API key once, then lands in the shell', async ({ page }) => {
  const account = newAccount();
  await register(page, account);

  await expect(page.getByRole('heading', { name: 'Your Organization Is Ready' })).toBeVisible();
  const key = page.getByLabel('API key');
  await expect(key).toHaveText(/^ff_live_[A-Za-z0-9_-]{32}$/);

  const proceed = page.getByRole('button', { name: 'Continue to flags' });
  await expect(proceed).toBeDisabled();
  await page.getByLabel("I've stored this key somewhere safe").check();
  await proceed.click();

  await expect(page).toHaveURL(/\/flags$/);
  await expect(page.getByRole('heading', { name: 'Flags', level: 1 })).toBeVisible();

  // The key was shown once: going back to /welcome no longer reveals it.
  await page.goto('/welcome');
  await expect(page).toHaveURL(/\/flags$/);
});

test('a session survives a reload (silent refresh) and ends on log out', async ({ page }) => {
  const account = newAccount();
  await register(page, account);
  await page.getByLabel("I've stored this key somewhere safe").check();
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await expect(page).toHaveURL(/\/flags$/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Flags', level: 1 })).toBeVisible();

  await openNav(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/flags');
  await expect(page).toHaveURL(/\/login$/);
});

test('log in, and a wrong password shows a plain error', async ({ page, consoleErrors }) => {
  const account = newAccount();
  await register(page, account);
  await page.getByLabel("I've stored this key somewhere safe").check();
  await page.getByRole('button', { name: 'Continue to flags' }).click();
  await openNav(page);
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  consoleErrors.allow(/status of 401/);
  await login(page, account.email, 'not-the-password');
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');

  await login(page, account.email, account.password);
  await expect(page).toHaveURL(/\/flags$/);
  await openNav(page);
  await expect(page.getByText(account.org, { exact: true }).filter({ visible: true })).toBeVisible();
});

test('the illustration mirrors the login form on wide screens', async ({ page, consoleErrors }, info) => {
  const art = page.getByTestId('auth-illustration');
  await page.goto('/login');
  if (info.project.name.includes('mobile')) {
    await expect(art).toBeHidden();
    return;
  }
  await expect(art).toBeVisible();
  // Field lines fill with the typed length; the password value itself never reaches the drawing.
  const widths = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('clipPath[id^="ffl-field"] rect')].map((r) =>
        parseFloat(r.getAttribute('width') ?? '0'),
      ),
    );
  await expect.poll(widths).toEqual([0, 0]);
  await page.getByLabel('Email').fill('someone@example.com');
  await page.getByLabel('Password').fill('not-the-password');
  await expect.poll(async () => (await widths()).every((w) => w > 0)).toBe(true);
  await expect(art).not.toContainText('not-the-password');

  consoleErrors.allow(/status of 401/);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid email or password');
  await expect(art).toHaveAttribute('data-status', 'error');
});

test('register validates fields with messages next to them', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 400/);
  await page.goto('/register');
  await page.getByLabel('Organization name').fill('Acme');
  await page.getByLabel('Your name').fill('Ada');
  await page.getByLabel('Work email').fill('not-an-email');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create organization' }).click();
  await expect(page.getByLabel('Work email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
});

test('an invited member joins from the email link', async ({ page, request }) => {
  test.skip(!!process.env.E2E_BASE_URL, 'reads the invite email from the local Mailpit');
  const admin = newAccount();
  const reg = await request.post('http://localhost:4020/api/auth/register', {
    data: { name: admin.name, email: admin.email, password: admin.password, organizationName: admin.org },
  });
  const { accessToken } = (await reg.json()) as { accessToken: string };
  const invitee = `bo-${Date.now()}@example.test`;
  await request.post('http://localhost:4020/api/team/invites', {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { email: invitee, role: 'MEMBER' },
  });

  // Read the invite link out of the email Mailpit received.
  let link: string | undefined;
  for (let i = 0; i < 25 && !link; i++) {
    const search = await request.get(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:"${invitee}"`)}`,
    );
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const msg = (await (
        await request.get(`http://localhost:8025/api/v1/message/${messages[0].ID}`)
      ).json()) as { Text: string };
      link = /\/invite\/[A-Za-z0-9_-]{43}/.exec(msg.Text)?.[0];
    }
    if (!link) await page.waitForTimeout(200);
  }
  expect(link).toBeDefined();

  await page.goto(link!);
  await expect(page.getByRole('heading', { name: `Join ${admin.org}` })).toBeVisible();
  await expect(page.getByText(invitee)).toBeVisible();
  await page.getByLabel('Your name').fill('Bo Member');
  await page.getByLabel('Password').fill('another-long-password');
  await page.getByRole('button', { name: `Join ${admin.org}` }).click();

  await expect(page).toHaveURL(/\/flags$/);
  await openNav(page);
  // Members get the workspace, not the admin section.
  await expect(page.getByRole('link', { name: 'Flags' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Team' })).toHaveCount(0);
});

test('a used or unknown invite link explains what to do', async ({ page, consoleErrors }) => {
  consoleErrors.allow(/status of 404/);
  await page.goto(`/invite/${'x'.repeat(43)}`);
  await expect(page.getByRole('heading', { name: "This Invite Can't Be Used" })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Ask an admin');
});

test('unknown routes show a 404 page', async ({ page }) => {
  await page.goto('/definitely/not/here');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
});
