import { defineConfig } from 'vitest/config';

const track = process.env.KATA_TRACK;

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['work/tests/**/*.test.{ts,tsx,js,jsx,mjs}'],
    environment: track === 'ts-frontend' ? 'jsdom' : 'node',
    setupFiles: track === 'ts-frontend' ? ['./setup-dom.mjs'] : [],
    globals: true,
    fileParallelism: track !== 'sql',
    testTimeout: 15_000,
    hookTimeout: 15_000,
    watch: false,
  },
});
