import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://rbsteiner.github.io/dados/
  base: '/dados/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
