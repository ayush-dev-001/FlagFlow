import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createDemoApp } from './app.js';
import type { FlagChange, FlagSource, LinkState } from './flags.js';

const ORIGIN = 'http://localhost:5174';

/** An in-memory FlagSource: flags on per user, changed by the test. */
function fakeSource(initial: Record<string, string[]> = {}) {
  const on = new Map(Object.entries(initial).map(([k, users]) => [k, new Set(users)]));
  const listeners = new Set<(c?: FlagChange) => void>();
  let version = 1;
  let state: LinkState = 'live';
  const source: FlagSource = {
    state: () => state,
    version: () => version,
    evaluate: (userId) => Object.fromEntries([...on].map(([k, users]) => [k, users.has(userId)])),
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  return {
    source,
    listeners,
    set(key: string, users: string[]) {
      on.set(key, new Set(users));
      version += 1;
      for (const l of listeners) l({ type: 'flag.updated', key, version });
    },
    setState(s: LinkState) {
      state = s;
      for (const l of listeners) l();
    },
  };
}

describe('demo-api', () => {
  it('evaluates the six demo flags for a user; unknown flags and users are off', async () => {
    const { source } = fakeSource({ dark_mode: ['U001'], something_else: ['U001'] });
    const app = createDemoApp({ flags: source, webOrigin: ORIGIN });
    const res = await request(app).get('/api/flags?userId=U001').expect(200);
    expect(res.body.flags).toEqual({
      dark_mode: true,
      chat_widget: false,
      analytics_dashboard: false,
      new_checkout: false,
      beta_banner: false,
      export_report: false,
    });
    expect((await request(app).get('/api/flags?userId=U002')).body.flags.dark_mode).toBe(false);
    expect((await request(app).get('/api/flags?userId=bad id')).status).toBe(400);
  });

  it('gates analytics, export and checkout on the server, not only in the UI', async () => {
    const fake = fakeSource();
    const app = createDemoApp({ flags: fake.source, webOrigin: ORIGIN });
    expect((await request(app).get('/api/analytics?userId=U003')).status).toBe(403);
    expect((await request(app).get('/api/orders/export.pdf?userId=U003')).status).toBe(403);
    const classic = await request(app)
      .post('/api/checkout')
      .send({ userId: 'U003', items: ['p1'] });
    expect(classic.body).toMatchObject({ flow: 'classic', total: 18 });

    fake.set('analytics_dashboard', ['U003']);
    fake.set('export_report', ['U003']);
    fake.set('new_checkout', ['U003']);
    expect((await request(app).get('/api/analytics?userId=U003')).body.orders).toBe(132);
    const pdf = await request(app).get('/api/orders/export.pdf?userId=U003').buffer(true).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(
      (
        await request(app)
          .post('/api/checkout')
          .send({ userId: 'U003', items: ['p1', 'p4'] })
      ).body,
    ).toMatchObject({ flow: 'new', total: 107 });
    expect(
      (
        await request(app)
          .post('/api/checkout')
          .send({ userId: 'U003', items: ['nope'] })
      ).status,
    ).toBe(400);
  });

  it('allows only the demo frontend origin', async () => {
    const app = createDemoApp({ flags: fakeSource().source, webOrigin: ORIGIN });
    const ok = await request(app).get('/api/users').set('origin', ORIGIN);
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    const other = await request(app).get('/api/users').set('origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('relays each change to the open stream at once, and stops listening when it closes', async () => {
    const fake = fakeSource();
    const server = createDemoApp({ flags: fake.source, webOrigin: ORIGIN }).listen(0);
    const { port } = server.address() as AddressInfo;
    const controller = new AbortController();
    const res = await fetch(`http://localhost:${port}/api/events?userId=U001`, { signal: controller.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const nextEvent = async () => {
      while (!text.includes('\n\n')) text += decoder.decode((await reader.read()).value);
      const [block, ...rest] = text.split('\n\n');
      text = rest.join('\n\n');
      return JSON.parse(
        block!
          .split('\n')
          .find((l) => l.startsWith('data: '))!
          .slice(6),
      ) as {
        flags: Record<string, boolean>;
        change: FlagChange | null;
        state: LinkState;
      };
    };

    const first = await nextEvent();
    expect(first.flags.dark_mode).toBe(false);
    expect(first.change).toBeNull();

    fake.set('dark_mode', ['U001']);
    const second = await nextEvent();
    expect(second.flags.dark_mode).toBe(true);
    expect(second.change).toMatchObject({ key: 'dark_mode', type: 'flag.updated' });

    fake.setState('reconnecting');
    expect((await nextEvent()).state).toBe('reconnecting');

    controller.abort();
    await new Promise((r) => setTimeout(r, 100));
    expect(fake.listeners.size).toBe(0);
    server.close();
  });
});
