import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://flagflow:flagflow@localhost:5432/flagflow',
  REDIS_URL: 'redis://localhost:6379/0',
  JWT_ACCESS_SECRET: 'x'.repeat(64),
  DASHBOARD_ORIGIN: 'http://localhost:5173',
  SMTP_URL: 'smtp://localhost:1025',
  MAIL_FROM: 'FlagFlow <no-reply@flagflow.local>',
};

describe('loadEnv', () => {
  it('applies defaults', () => {
    const env = loadEnv(valid);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'info',
      REFRESH_TOKEN_TTL_DAYS: 7,
    });
  });

  it('coerces numeric values', () => {
    expect(loadEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a short JWT secret without echoing it', () => {
    const secret = 'short-secret-value';
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: secret })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => loadEnv({ ...valid, JWT_ACCESS_SECRET: secret })).not.toThrow(new RegExp(secret));
  });

  it('rejects missing and malformed URLs', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ ...valid, REDIS_URL: 'not a url' })).toThrow(/REDIS_URL/);
  });

  it('never allows raised rate limits in production', () => {
    expect(loadEnv({ ...valid, NODE_ENV: 'test', RATE_LIMIT_SCALE: '100' }).RATE_LIMIT_SCALE).toBe(100);
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production', RATE_LIMIT_SCALE: '100' })).toThrow(
      /RATE_LIMIT_SCALE/,
    );
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
