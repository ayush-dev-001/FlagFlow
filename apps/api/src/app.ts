import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { PrismaClient } from './db.js';
import type { Env } from './env.js';
import { errorHandler, notFound } from './errors.js';
import { healthRouter } from './health.js';
import type { Logger } from './logger.js';
import type { Redis } from './redis.js';

export interface AppDeps {
  env: Pick<Env, 'DASHBOARD_ORIGIN'>;
  logger: Logger;
  prisma: PrismaClient;
  redis: Redis;
}

const BODY_LIMIT = '100kb';
// A caller-supplied request id is reused only if it is short and plain, so it can't inject into logs or headers.
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function createApp({ env, logger, prisma, redis }: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

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

  // The dashboard is the only browser origin; /v1 is server-to-server and gets no CORS (ARCHITECTURE §9).
  app.use('/api', cors({ origin: env.DASHBOARD_ORIGIN, credentials: true }));
  app.use('/api/health', healthRouter(prisma, redis));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
