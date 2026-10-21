import express from 'express';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, errorHandler } from './errors.js';
import { silentLogger } from './test/helpers.js';

function appThrowing(err: unknown) {
  const app = express();
  app.use(pinoHttp({ logger: silentLogger }));
  app.get('/boom', () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('renders AppError with its status, code and details', async () => {
    const res = await request(appThrowing(new AppError(409, 'CONFLICT', 'Flag key taken', { key: 'x' }))).get(
      '/boom',
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Flag key taken', details: { key: 'x' } },
    });
  });

  it('turns zod errors into VALIDATION_ERROR with field paths', async () => {
    const parsed = z.object({ key: z.string().regex(/^[a-z0-9_]{2,64}$/) }).safeParse({ key: 'Bad Key' });
    const res = await request(appThrowing(parsed.error)).get('/boom');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].path).toBe('key');
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const res = await request(appThrowing(new Error('connection string postgres://secret'))).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(res.text).not.toContain('secret');
  });
});
