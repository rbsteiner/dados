import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://rbsteiner.github.io/dados/
  base: '/dados/',
  // Lets the dev-only screenshot container reach the dev server by its compose service name.
  server: {
    allowedHosts: ['devserver'],
    // File change events don't reliably cross the Colima file share, so poll instead.
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
