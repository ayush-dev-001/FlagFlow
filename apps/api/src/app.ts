import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { adminRouter } from './admin/routes.js';
import { authRouter } from './auth/routes.js';
import { sessions } from './auth/sessions.js';
import type { PrismaClient } from './db.js';
import type { Env } from './env.js';
import { errorHandler, notFound } from './errors.js';
import { flagRoutes } from './flags/routes.js';
import { flagService } from './flags/service.js';
import { healthRouter } from './health.js';
import type { Logger } from './logger.js';
import type { Mailer } from './mailer.js';
import { docsRouter } from './openapi.js';
import { orgRouter } from './org/routes.js';
import { publicRouter } from './public/routes.js';
import { snapshotStore } from './public/snapshots.js';
import { StreamHub, type StreamOptions } from './public/stream.js';
import { createLimiters } from './rateLimit.js';
import { dashboardStatic } from './static.js';
import type { Redis } from './redis.js';
import { teamRouter } from './team/routes.js';

export interface AppDeps {
  env: Pick<
    Env,
    | 'DASHBOARD_ORIGIN'
    | 'JWT_ACCESS_SECRET'
    | 'REFRESH_TOKEN_TTL_DAYS'
    | 'TRUST_PROXY'
    | 'RATE_LIMIT_SCALE'
    | 'DASHBOARD_DIST'
  >;
  logger: Logger;
  prisma: PrismaClient;
  redis: Redis;
  mailer: Mailer;
  streamOptions?: StreamOptions;
}

const BODY_LIMIT = '100kb';
// A caller-supplied request id is reused only if it is short and plain, so it can't inject into logs or headers.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createApp({ env, logger, prisma, redis, mailer, streamOptions }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(helmet());
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());

  // The dashboard is the only browser origin; /v1 is server-to-server and gets no CORS (ARCHITECTURE §9).
  app.use('/api', cors({ origin: env.DASHBOARD_ORIGIN, credentials: true }));

  const limiters = createLimiters(redis, env.RATE_LIMIT_SCALE);
  const userSessions = sessions({ prisma, redis, logger, ttlDays: env.REFRESH_TOKEN_TTL_DAYS });
  const jwtSecret = env.JWT_ACCESS_SECRET;

  app.use('/api/health', healthRouter(prisma, redis));
  app.use('/api/docs', docsRouter());
  app.use('/api/auth', authRouter({ prisma, redis, limiters, jwtSecret, sessions: userSessions }));
  app.use(
    '/api/team',
    teamRouter({
      prisma,
      redis,
      limiters,
      mailer,
      jwtSecret,
      sessions: userSessions,
      dashboardOrigin: env.DASHBOARD_ORIGIN,
    }),
  );
  const snapshots = snapshotStore(prisma, redis, logger);
  const streams = new StreamHub(redis, snapshots, logger, streamOptions);
  (app.locals as AppLocals).streams = streams;
  const { flagsRouter, endUsersRouter, auditRouter } = flagRoutes({
    prisma,
    redis,
    limiters,
    jwtSecret,
    flags: flagService(prisma, redis, logger),
    connectedClients: (orgId) => streams.connectedClients(orgId),
  });
  app.use('/api/flags', flagsRouter);
  app.use('/api/end-users', endUsersRouter);
  app.use('/api/audit-logs', auditRouter);
  app.use('/api/org', orgRouter({ prisma, redis, limiters, jwtSecret }));
  app.use('/api/admin', adminRouter({ prisma, redis, limiters, jwtSecret, sessions: userSessions }));

  app.use('/v1', publicRouter({ prisma, redis, logger, limiters, snapshots, streams }));

  // Production serves the built dashboard from this same origin, so its refresh cookie is first-party
  // (owner decision, 2026-10-26). Unknown /api and /v1 paths still get the JSON 404 below.
  if (env.DASHBOARD_DIST) app.use(dashboardStatic(env.DASHBOARD_DIST));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

interface AppLocals {
  streams?: StreamHub;
}

/** Ends open SSE streams and the stream subscriber. Call before closing Redis. */
export async function closeApp(app: Express) {
  await (app.locals as AppLocals).streams?.close();
}
