import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20000,
  },
  optimizeDeps: {
    exclude: ['pdf-parse', 'pdf-parse/lib/pdf-parse.js'],
  },
});
