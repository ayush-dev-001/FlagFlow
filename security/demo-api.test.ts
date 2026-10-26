// Phase 8 attack tests: the demo customer backend. It holds a FlagFlow API key, so it must never leak it,
// must gate its own features on the server, and must refuse other browser origins and junk input.
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDemoApp } from '../apps/demo-api/src/app.js';
import type { FlagSource } from '../apps/demo-api/src/flags.js';

const ORIGIN = 'http://localhost:5174';
const SECRET = 'ff_live_' + 'x'.repeat(32);

/** Every flag off except the given ones, for everyone. */
const source = (on: string[] = []): FlagSource => ({
  state: () => 'live',
  version: () => 7,
  evaluate: () => Object.fromEntries(on.map((k) => [k, true])),
  subscribe: () => () => {},
});

const app = (on?: string[]) => createDemoApp({ flags: source(on), webOrigin: ORIGIN });

describe('demo-api', () => {
  it('never exposes the FlagFlow API key, on any route', async () => {
    process.env.FLAGFLOW_API_KEY = SECRET;
    const a = app(['analytics_dashboard', 'export_report']);
    for (const path of [
      '/health',
      '/api/users',
      '/api/flags?userId=U001',
      '/api/analytics?userId=U001',
      '/nope',
    ]) {
      const res = await request(a).get(path);
      expect(JSON.stringify(res.body) + JSON.stringify(res.headers)).not.toContain(SECRET);
    }
    delete process.env.FLAGFLOW_API_KEY;
  });

  it('feature routes are gated on the server: a flag that is off means 403, whatever the client claims', async () => {
    const a = app();
    for (const path of ['/api/analytics?userId=U001', '/api/orders/export.pdf?userId=U001']) {
      const res = await request(a).get(path).set('x-feature', 'on').set('cookie', 'analytics_dashboard=true');
      expect(res.status).toBe(403);
    }
    const checkout = await request(a)
      .post('/api/checkout')
      .send({ userId: 'U001', items: ['p1'], flow: 'new' });
    expect(checkout.body.flow).toBe('classic');
  });

  it('only the demo frontend origin gets CORS headers, preflight included', async () => {
    const a = app();
    for (const origin of ['https://evil.example', 'http://localhost:5174.evil.example', 'null']) {
      const res = await request(a).options('/api/checkout').set('origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
    const ok = await request(a).options('/api/checkout').set('origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
  });

  it('injection and junk in userId are rejected before use, including in the PDF filename header', async () => {
    const a = app(['export_report']);
    for (const id of [
      "' OR 1=1 --",
      '<script>alert(1)</script>',
      'U001\r\nSet-Cookie: x=1',
      'a'.repeat(129),
      '',
    ]) {
      const res = await request(a).get(`/api/orders/export.pdf?userId=${encodeURIComponent(id)}`);
      expect(res.status).toBe(400);
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('rejects oversized and malformed checkout bodies', async () => {
    const a = app();
    const big = await request(a)
      .post('/api/checkout')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ userId: 'U001', items: Array(5000).fill('p1') }));
    expect(big.status).toBe(413);
    for (const items of [[], ['p1', { $gt: '' }], 'p1', Array(51).fill('p1'), ['p9']]) {
      expect((await request(a).post('/api/checkout').send({ userId: 'U001', items })).status).toBe(400);
    }
  });

  it('sends no-store and nosniff, and no x-powered-by', async () => {
    const res = await request(app()).get('/api/flags?userId=U001');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
