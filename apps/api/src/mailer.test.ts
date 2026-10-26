import { describe, expect, it } from 'vitest';
import { smtpOptions } from './mailer.js';

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
