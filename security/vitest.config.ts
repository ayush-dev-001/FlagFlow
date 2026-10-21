import { defineConfig } from 'vitest/config';

// Attack suite (PLAN.md §6.4). Tests are added as each phase ships routes; they run against the local API.
export default defineConfig({
  test: {
    include: ['security/**/*.test.ts'],
    passWithNoTests: true,
  },
});
