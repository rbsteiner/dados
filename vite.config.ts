import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://rbsteiner.github.io/dados/
  base: '/dados/',
  // Lets the dev-only screenshot container reach the dev server by its compose service name.
  server: { allowedHosts: ['devserver'] },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
