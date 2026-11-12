import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    retry: 0,
    // The first request to the development server compiles the page.
    testTimeout: 15_000,
  },
});
