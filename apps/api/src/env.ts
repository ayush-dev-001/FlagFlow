import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    // 32 random bytes encode to 43 base64url characters.
    JWT_ACCESS_SECRET: z.string().min(43, 'must be at least 32 random bytes (43+ base64url characters)'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    DASHBOARD_ORIGIN: z.url(),
    // Proxy hops in front of the API. 0 ignores X-Forwarded-For, so clients can't spoof their IP past rate limits.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    // Invite email goes out over SMTP, or over an HTTPS API (port 443: hosts such as Render's free plan block
    // outbound SMTP): Brevo with BREVO_API_KEY, or Resend with RESEND_API_KEY. One of the three is required.
    SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    RESEND_API_KEY: z
      .string()
      .regex(/^re_[A-Za-z0-9_-]{8,}$/, 'must be a Resend API key (re_...)')
      .optional(),
    BREVO_API_KEY: z
      .string()
      .regex(/^xkeysib-[A-Za-z0-9-]{16,}$/, 'must be a Brevo API key (xkeysib-...)')
      .optional(),
    MAIL_FROM: z.string().min(3),
    // Multiplies every rate limit. Only the local ZAP scan raises it, so the scanner isn't throttled into
    // testing nothing; the real limits are covered by the attack suite.
    RATE_LIMIT_SCALE: z.coerce.number().int().min(1).max(1000).default(1),
    // Path to the built dashboard (apps/dashboard/dist). Set in production, where one service serves both.
    DASHBOARD_DIST: z.string().min(1).optional(),
  })
  .refine(
    (e) => e.SMTP_URL !== undefined || e.RESEND_API_KEY !== undefined || e.BREVO_API_KEY !== undefined,
    {
      path: ['SMTP_URL'],
      message: 'set SMTP_URL, RESEND_API_KEY or BREVO_API_KEY',
    },
  )
  .refine((e) => e.NODE_ENV !== 'production' || e.RATE_LIMIT_SCALE === 1, {
    path: ['RATE_LIMIT_SCALE'],
    message: 'must be 1 in production',
  });

export type Env = z.infer<typeof schema>;

/** Parses and validates the environment. Errors name the bad keys but never echo their values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // On Render the API serves the dashboard itself, so its own public URL is the dashboard origin.
  const result = schema.safeParse({
    ...source,
    DASHBOARD_ORIGIN: source.DASHBOARD_ORIGIN ?? source.RENDER_EXTERNAL_URL,
  });
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}
