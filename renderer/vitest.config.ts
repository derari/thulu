import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.test.js'],
    exclude: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/*.spec.ts']
  }
});
