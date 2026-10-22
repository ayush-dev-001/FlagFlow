import { z } from 'zod';

const schema = z.object({
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
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  MAIL_FROM: z.string().min(3),
});

export type Env = z.infer<typeof schema>;

/** Parses and validates the environment. Errors name the bad keys but never echo their values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return result.data;
}
