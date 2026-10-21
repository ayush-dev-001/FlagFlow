import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env itself. An explicit DATABASE_URL (tests, CI) wins over the file.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  datasource: { url: env('DATABASE_URL') },
});
