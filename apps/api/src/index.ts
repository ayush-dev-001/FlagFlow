import { existsSync } from 'node:fs';
import { closeApp, createApp } from './app.js';
import { createPrisma } from './db.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';
import { createMailer } from './mailer.js';
import { createRedis } from './redis.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);
redis.on('error', (err) => logger.warn({ err }, 'redis connection error'));

const app = createApp({ env, logger, prisma, redis, mailer: createMailer(env) });
const server = app.listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT}`);
});

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'shutting down');
  // SSE streams never finish on their own, so end them first or server.close() would wait forever.
  void closeApp(app).finally(() => {
    server.close(() => {
      void Promise.allSettled([prisma.$disconnect(), redis.quit()]).then(() => process.exit(0));
    });
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
