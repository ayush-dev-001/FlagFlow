import { describe, expect, it } from 'vitest';
import { createMailer, type InviteEmail, MailRefusedError, parseSender, smtpOptions } from './mailer.js';

describe('smtpOptions', () => {
  it('reads host, port, TLS and credentials from the URL, with short timeouts', () => {
    expect(smtpOptions('smtps://resend:re_a%2Bb@smtp.resend.com:2465')).toMatchObject({
      host: 'smtp.resend.com',
      port: 2465,
      secure: true,
      auth: { user: 'resend', pass: 're_a+b' },
      connectionTimeout: 10_000,
    });
  });

  it('defaults the port by scheme and leaves auth out when there is none', () => {
    expect(smtpOptions('smtp://localhost')).toMatchObject({ port: 587, secure: false });
    expect(smtpOptions('smtp://localhost:1025')).not.toHaveProperty('auth');
    expect(smtpOptions('smtps://mail.example.test').port).toBe(465);
  });
});

// Built at runtime so secret scanners don't mistake a test value for a real key.
const KEY = `re_${'x'.repeat(20)}`;
const invite: InviteEmail = {
  to: 'mia@example.test',
  organizationName: 'Acme\r\nBcc: evil@example.test',
  inviterName: 'Ada',
  role: 'MEMBER',
  link: 'https://flagflow.example/invite/abc',
  expiresAt: new Date('2026-10-28T12:00:00Z'),
};

/** A fetch stand-in that records the call and answers with the given status and body. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('Resend HTTPS mailer', () => {
  const env = { MAIL_FROM: 'FlagFlow <onboarding@resend.dev>', RESEND_API_KEY: KEY };

  it('posts the invite to the Resend API with a one-line subject', async () => {
    const f = fakeFetch(200, { id: 'email_1' });
    await createMailer(env, f.impl).sendInvite(invite);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.url).toBe('https://api.resend.com/emails');
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    const sent = JSON.parse(f.calls[0]!.init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({ from: env.MAIL_FROM, to: ['mia@example.test'] });
    expect(sent.subject).not.toMatch(/[\r\n]/);
    expect(sent.text).toContain(invite.link);
  });

  it('is used instead of SMTP when both are set', async () => {
    const f = fakeFetch(200, {});
    await createMailer({ ...env, SMTP_URL: 'smtp://localhost:1' }, f.impl).sendInvite(invite);
    expect(f.calls).toHaveLength(1);
  });

  it('throws on a refusal, with Resend’s reason but never the key', async () => {
    const f = fakeFetch(403, { message: 'You can only send testing emails to your own email address' });
    const err = await createMailer(env, f.impl)
      .sendInvite(invite)
      .then(() => new Error('expected a refusal'))
      .catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('403');
    expect(err.message).toContain('your own email address');
    expect(err.message).not.toContain(KEY);
    expect(err).toBeInstanceOf(MailRefusedError);
    expect((err as MailRefusedError).reason).toBe('recipient-not-allowed');
  });

  it('tells other refusals apart from a recipient the account may not send to', async () => {
    const f = fakeFetch(422, { message: 'Invalid from field' });
    const err = await createMailer(env, f.impl)
      .sendInvite(invite)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MailRefusedError);
    expect((err as MailRefusedError).reason).toBe('other');
  });

  it('needs one of SMTP_URL, RESEND_API_KEY or BREVO_API_KEY', () => {
    expect(() => createMailer({ MAIL_FROM: env.MAIL_FROM })).toThrow(
      /SMTP_URL, RESEND_API_KEY or BREVO_API_KEY/,
    );
  });
});

describe('parseSender', () => {
  it('splits a display name from the address, or takes a bare address', () => {
    expect(parseSender('FlagFlow <me@gmail.com>')).toEqual({ name: 'FlagFlow', email: 'me@gmail.com' });
    expect(parseSender('"Flag Flow" <me@gmail.com>')).toEqual({ name: 'Flag Flow', email: 'me@gmail.com' });
    expect(parseSender(' me@gmail.com ')).toEqual({ name: undefined, email: 'me@gmail.com' });
  });
});

describe('Brevo HTTPS mailer', () => {
  // Built at runtime so secret scanners don't mistake a test value for a real key.
  const BREVO = `xkeysib-${'x'.repeat(24)}`;
  const env = { MAIL_FROM: 'FlagFlow <owner@gmail.com>', BREVO_API_KEY: BREVO };

  it('posts the invite to Brevo with the verified sender and a one-line subject', async () => {
    const f = fakeFetch(201, { messageId: '<1@smtp-relay.mailin.fr>' });
    await createMailer(env, f.impl).sendInvite(invite);
    expect(f.calls[0]!.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((f.calls[0]!.init.headers as Record<string, string>)['api-key']).toBe(BREVO);
    const sent = JSON.parse(f.calls[0]!.init.body as string) as Record<string, unknown>;
    expect(sent).toMatchObject({
      sender: { name: 'FlagFlow', email: 'owner@gmail.com' },
      to: [{ email: 'mia@example.test' }],
    });
    expect(sent.subject).not.toMatch(/[\r\n]/);
    expect(sent.textContent).toContain(invite.link);
  });

  it('is preferred over Resend and SMTP when set', async () => {
    const f = fakeFetch(201, {});
    await createMailer({ ...env, RESEND_API_KEY: KEY, SMTP_URL: 'smtp://localhost:1' }, f.impl).sendInvite(
      invite,
    );
    expect(f.calls[0]!.url).toContain('api.brevo.com');
  });

  it('throws on a refusal with Brevo’s reason, never the key', async () => {
    const f = fakeFetch(400, { code: 'invalid_parameter', message: 'Sender is not valid' });
    const err = await createMailer(env, f.impl)
      .sendInvite(invite)
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MailRefusedError);
    expect((err as Error).message).toContain('Sender is not valid');
    expect((err as Error).message).not.toContain(BREVO);
  });
});
