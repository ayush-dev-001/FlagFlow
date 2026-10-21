import { defineConfig } from 'vitest/config';

// Unit and integration tests. The attack suite in security/ runs separately via `npm run security`.
export default defineConfig({
  test: {
    include: ['{apps,packages}/*/src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
