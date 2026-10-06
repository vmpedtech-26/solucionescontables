import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js']
  }
});
