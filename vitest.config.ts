import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest
    // unit tests — excluding it prevents Vitest from trying to execute them
    // under its own test runner, where Playwright's test()/describe() fail.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
