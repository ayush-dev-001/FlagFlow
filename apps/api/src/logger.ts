import { pino, type Logger } from 'pino';
import type { Env } from './env.js';

export type { Logger };

export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    // Credentials never reach the logs.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-api-key"]',
        'res.headers["set-cookie"]',
      ],
      censor: '[redacted]',
    },
    ...(env.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
  });
}
