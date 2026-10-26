import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import express, { type RequestHandler, Router } from 'express';

/**
 * Serves the dashboard's production build. Hashed assets are cached for a year; index.html is never
 * cached, so a deploy is picked up on the next load. Any other GET outside /api and /v1 gets index.html,
 * because the dashboard routes in the browser.
 */
export function dashboardStatic(dist: string): RequestHandler {
  const root = resolve(dist);
  const index = join(root, 'index.html');
  if (!existsSync(index)) throw new Error(`DASHBOARD_DIST has no index.html: ${root}`);

  const router = Router();
  router.use(
    '/assets',
    express.static(join(root, 'assets'), { immutable: true, maxAge: '1y', index: false }),
  );
  router.use(express.static(root, { index: false, maxAge: '1h' }));
  // A missing asset falls through to the JSON 404 rather than getting the app's HTML.
  router.get(/^\/(?!api(\/|$)|v1(\/|$)|assets\/).*/, (_req, res) => {
    res.set('cache-control', 'no-cache').sendFile(index);
  });
  return router;
}
