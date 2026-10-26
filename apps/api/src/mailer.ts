import nodemailer from 'nodemailer';
import type { Env } from './env.js';

export interface InviteEmail {
  to: string;
  organizationName: string;
  inviterName: string;
  role: string;
  link: string;
  expiresAt: Date;
}

export interface Mailer {
  sendInvite(email: InviteEmail): Promise<void>;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Builds the invite message. Org and inviter names are user input, so they are escaped in the HTML part. */
export function renderInvite(e: InviteEmail) {
  const role = e.role.toLowerCase();
  const expires = e.expiresAt.toUTCString();
  return {
    // nodemailer strips CR/LF from headers, so a name can't inject extra headers into the subject.
    subject: `You're invited to ${e.organizationName} on FlagFlow`,
    text:
      `${e.inviterName} invited you to join ${e.organizationName} on FlagFlow as ${role}.\n\n` +
      `Accept the invite: ${e.link}\n\nThis link expires ${expires}.`,
    html:
      `<p>${escapeHtml(e.inviterName)} invited you to join <strong>${escapeHtml(e.organizationName)}</strong> ` +
      `on FlagFlow as ${escapeHtml(role)}.</p>` +
      `<p><a href="${escapeHtml(e.link)}">Accept the invite</a></p>` +
      `<p>This link expires ${escapeHtml(expires)}.</p>`,
  };
}

/** SMTP settings from a URL, with short timeouts so a blocked or wrong server fails in seconds, not minutes. */
export function smtpOptions(smtpUrl: string) {
  const url = new URL(smtpUrl);
  const secure = url.protocol === 'smtps:';
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : secure ? 465 : 587,
    secure,
    ...(url.username && {
      auth: { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) },
    }),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

const RESEND_API = 'https://api.resend.com/emails';

/** Sends through Resend's HTTPS API (port 443). The key never appears in errors or logs. */
function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch): Mailer {
  return {
    async sendInvite(email) {
      const { subject, text, html } = renderInvite(email);
      const res = await fetchImpl(RESEND_API, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        // A JSON body has no header injection, but keep the subject to one line all the same.
        body: JSON.stringify({ from, to: [email.to], subject: subject.replace(/[\r\n]+/g, ' '), text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const detail = ((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? '';
        throw new Error(`Resend refused the email (${res.status})${detail ? `: ${detail}` : ''}`);
      }
    },
  };
}

export function createMailer(
  env: Pick<Env, 'SMTP_URL' | 'MAIL_FROM' | 'RESEND_API_KEY'>,
  fetchImpl: typeof fetch = fetch,
): Mailer {
  if (env.RESEND_API_KEY) return resendMailer(env.RESEND_API_KEY, env.MAIL_FROM, fetchImpl);
  if (!env.SMTP_URL) throw new Error('Set SMTP_URL or RESEND_API_KEY to send invite email');
  const transport = nodemailer.createTransport(smtpOptions(env.SMTP_URL));
  return {
    async sendInvite(email) {
      await transport.sendMail({ from: env.MAIL_FROM, to: email.to, ...renderInvite(email) });
    },
  };
}
