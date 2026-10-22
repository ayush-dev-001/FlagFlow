import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit and integration tests. The attack suite in security/ runs separately via `npm run security`.
export default defineConfig({
  // Tests run against workspace sources, so they don't need packages built first.
  resolve: {
    alias: {
      '@flagflow/shared': fileURLToPath(new URL('packages/shared/src/index.ts', import.meta.url)),
      '@flagflow/flag-client': fileURLToPath(new URL('packages/flag-client/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    globalSetup: ['apps/api/src/test/global-setup.ts'],
    // Integration tests share one test database, so files run one at a time.
    fileParallelism: false,
    passWithNoTests: true,
  },
});
