import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { createPrisma } from './db.js';
import { loadEnv } from './env.js';
import { createMailer } from './mailer.js';
import { createLogger } from './logger.js';
import { createRedis } from './redis.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const env = loadEnv();
const logger = createLogger(env);
const prisma = createPrisma(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);
redis.on('error', (err) => logger.warn({ err }, 'redis connection error'));

const server = createApp({ env, logger, prisma, redis, mailer: createMailer(env) }).listen(env.PORT, () => {
  logger.info(`api listening on http://localhost:${env.PORT}`);
});

let closing = false;
function shutdown(signal: string) {
  if (closing) return;
  closing = true;
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    void Promise.allSettled([prisma.$disconnect(), redis.quit()]).then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
