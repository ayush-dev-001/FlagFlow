import { defineConfig } from 'vitest/config';

// Attack suite (PLAN.md §6.4). Runs in-process against the API, on the docker test database.
export default defineConfig({
  test: {
    include: ['security/**/*.test.ts'],
    globalSetup: ['apps/api/src/test/global-setup.ts'],
    fileParallelism: false,
    passWithNoTests: true,
  },
});
