import express, { type Request, type Response } from 'express';
import { DEMO_FLAGS, demoFlags, type FlagChange, type FlagSource } from './flags.js';
import { textPdf } from './pdf.js';

// The demo customer's backend. It holds the FlagFlow API key (the browser never sees it), evaluates flags
// locally through flag-client, gates its own features with them, and relays changes to its frontend over
// its own SSE stream.

export const DEMO_USERS = [
  { id: 'U001', name: 'Maya Chen' },
  { id: 'U002', name: 'Leo Martins' },
  { id: 'U003', name: 'Sam Okafor' },
  { id: 'U004', name: 'Inés Duval' },
  { id: 'U005', name: 'Kofi Mensah' },
] as const;

const PRODUCTS = [
  { id: 'p1', name: 'Field Notebook', price: 18, tone: 'sand' },
  { id: 'p2', name: 'Brass Pen', price: 42, tone: 'ochre' },
  { id: 'p3', name: 'Canvas Tote', price: 29, tone: 'olive' },
  { id: 'p4', name: 'Desk Lamp', price: 89, tone: 'slate' },
] as const;

const ORDERS = [
  { id: 'A-1042', date: '2026-10-21', items: 2, total: 60 },
  { id: 'A-1038', date: '2026-10-17', items: 1, total: 89 },
  { id: 'A-1031', date: '2026-10-09', items: 3, total: 89 },
] as const;

const ANALYTICS = {
  revenue: 4820,
  orders: 132,
  conversion: 3.4,
  weekly: [
    { week: 'W38', orders: 21 },
    { week: 'W39', orders: 28 },
    { week: 'W40', orders: 24 },
    { week: 'W41', orders: 31 },
    { week: 'W42', orders: 28 },
  ],
};

const USER_ID = /^[A-Za-z0-9_.:@-]{1,128}$/;

export interface DemoAppOptions {
  flags: FlagSource;
  /** The demo frontend's origin: the only browser origin allowed to call this API. */
  webOrigin: string;
  heartbeatMs?: number;
}

const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

function userOf(req: Request, res: Response): string | null {
  const raw =
    typeof req.query.userId === 'string' ? req.query.userId : (req.body as { userId?: unknown })?.userId;
  if (typeof raw !== 'string' || !USER_ID.test(raw)) {
    fail(res, 400, 'VALIDATION_ERROR', 'userId is required: letters, digits and _ . : @ - only');
    return null;
  }
  return raw;
}

export function createDemoApp({ flags, webOrigin: configured, heartbeatMs = 25_000 }: DemoAppOptions) {
  // Browsers send the origin without a trailing slash; a URL pasted with one would otherwise never match.
  const webOrigin = configured.trim().replace(/\/+$/, '');
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.use((req, res, next) => {
    res.set({ 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' });
    if (req.get('origin') === webOrigin) {
      res.set({
        'access-control-allow-origin': webOrigin,
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'GET, POST',
        vary: 'origin',
      });
    }
    if (req.method === 'OPTIONS') return void res.status(204).end();
    next();
  });

  const snapshot = (userId: string) => ({
    userId,
    state: flags.state(),
    version: flags.version(),
    flags: demoFlags(flags, userId),
  });

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      flagflow: flags.state(),
      version: flags.version(),
      lastError: flags.lastError?.() ?? null,
    });
  });

  app.get('/api/users', (_req, res) => {
    res.json({ users: DEMO_USERS });
  });

  app.get('/api/flags', (req, res) => {
    const userId = userOf(req, res);
    if (userId) res.json(snapshot(userId));
  });

  // Live updates for one user: the current flags at once, then again after every change in FlagFlow.
  app.get('/api/events', (req, res) => {
    const userId = userOf(req, res);
    if (!userId) return;
    res.status(200).set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    res.flushHeaders();

    const send = (change?: FlagChange) =>
      res.write(`event: flags\ndata: ${JSON.stringify({ ...snapshot(userId), change: change ?? null })}\n\n`);
    send();
    const unsubscribe = flags.subscribe(send);
    const heartbeat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get('/api/catalog', (_req, res) => {
    res.json({ products: PRODUCTS });
  });

  app.get('/api/orders', (req, res) => {
    if (userOf(req, res)) res.json({ orders: ORDERS });
  });

  // The backend enforces the same flags as the frontend: hiding a button is not access control.
  app.get('/api/analytics', (req, res) => {
    const userId = userOf(req, res);
    if (!userId) return;
    if (!demoFlags(flags, userId).analytics_dashboard) {
      return void fail(res, 403, 'FEATURE_OFF', 'Analytics is not enabled for this account');
    }
    res.json(ANALYTICS);
  });

  app.get('/api/orders/export.pdf', (req, res) => {
    const userId = userOf(req, res);
    if (!userId) return;
    if (!demoFlags(flags, userId).export_report) {
      return void fail(res, 403, 'FEATURE_OFF', 'Report export is not enabled for this account');
    }
    const pdf = textPdf([
      { text: 'Acme - Order report', size: 20, gap: 30 },
      { text: `Account ${userId}`, gap: 28 },
      ...ORDERS.map((o) => ({ text: `${o.id}   ${o.date}   ${o.items} items   $${o.total}` })),
      { text: '', gap: 10 },
      { text: `Total  $${ORDERS.reduce((n, o) => n + o.total, 0)}`, size: 12 },
    ]);
    res
      .status(200)
      .set({
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="acme-orders-${userId}.pdf"`,
      })
      .send(pdf);
  });

  app.post('/api/checkout', (req, res) => {
    const userId = userOf(req, res);
    if (!userId) return;
    const items = (req.body as { items?: unknown }).items;
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50 ||
      !items.every((i) => typeof i === 'string')
    ) {
      return void fail(res, 400, 'VALIDATION_ERROR', 'items must be a non-empty list of product ids');
    }
    const known = new Set<string>(PRODUCTS.map((p) => p.id));
    if (!items.every((i) => known.has(i))) {
      return void fail(res, 400, 'VALIDATION_ERROR', 'Unknown product');
    }
    const total = items.reduce((n, id) => n + (PRODUCTS.find((p) => p.id === id)?.price ?? 0), 0);
    res.status(201).json({
      orderId: `A-${1043 + Math.floor(Math.random() * 900)}`,
      total,
      // Which checkout handled it, decided on the server by the same flag.
      flow: demoFlags(flags, userId).new_checkout ? 'new' : 'classic',
    });
  });

  app.use((_req, res) => fail(res, 404, 'NOT_FOUND', 'Not found'));

  return app;
}

export { DEMO_FLAGS };
