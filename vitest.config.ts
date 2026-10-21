import { defineConfig } from 'vitest/config';

// Unit and integration tests. The attack suite in security/ runs separately via `npm run security`.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    globalSetup: ['apps/api/src/test/global-setup.ts'],
    // Integration tests share one test database, so files run one at a time.
    fileParallelism: false,
    passWithNoTests: true,
  },
});
