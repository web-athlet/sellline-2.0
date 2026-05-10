import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@nextgen/types': resolve(__dirname, '../../packages/types/src/index.ts'),
      '@nextgen/utils': resolve(__dirname, '../../packages/utils/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['hooks/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts', 'hooks/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'lib/socket.ts',
        // NextAuth config is declarative wiring — exercised end-to-end, not unit-tested
        'lib/auth-options.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
