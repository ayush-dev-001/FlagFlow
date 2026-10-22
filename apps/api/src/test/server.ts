import type { AddressInfo } from 'node:net';
import { parseSse, type SseMessage } from '@flagflow/flag-client';
import type { Express } from 'express';

/** Runs the app on a random local port; SSE needs a real socket, not supertest. */
export async function listen(app: Express) {
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export interface TestStream {
  status: number;
  messages: SseMessage[];
  /** Resolves with the next message (after `from`) matching `event`, or rejects after `timeoutMs`. */
  next(event: string, timeoutMs?: number): Promise<SseMessage & { receivedAt: number }>;
  ended: Promise<void>;
  close(): void;
}

/** Opens /v1/stream and records every message with its arrival time. */
export async function openStream(baseUrl: string, apiKey: string, lastEventId?: number): Promise<TestStream> {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/v1/stream`, {
    headers: {
      'x-api-key': apiKey,
      ...(lastEventId !== undefined && { 'last-event-id': String(lastEventId) }),
    },
    signal: controller.signal,
  });
  const messages: (SseMessage & { receivedAt: number })[] = [];
  const waiters: { event: string; resolve: (m: SseMessage & { receivedAt: number }) => void }[] = [];
  let consumed = 0;

  const ended = (async () => {
    if (!res.ok || !res.body) return;
    try {
      for await (const msg of parseSse(res.body)) {
        const stamped = { ...msg, receivedAt: performance.now() };
        messages.push(stamped);
        const i = waiters.findIndex((w) => w.event === msg.event);
        if (i !== -1) {
          consumed = messages.length;
          waiters.splice(i, 1)[0]!.resolve(stamped);
        }
      }
    } catch {
      // aborted
    }
  })();

  return {
    status: res.status,
    messages,
    ended,
    close: () => controller.abort(),
    next: (event, timeoutMs = 3000) => {
      const already = messages.slice(consumed).find((m) => m.event === event);
      if (already) {
        consumed = messages.indexOf(already) + 1;
        return Promise.resolve(already);
      }
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no "${event}" within ${timeoutMs}ms`)), timeoutMs);
        waiters.push({
          event,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
        });
      });
    },
  };
}
