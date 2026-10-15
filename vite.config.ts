import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://<user>.github.io/dicewars/
  base: '/dicewars/',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
