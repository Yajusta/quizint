import react from '@vitejs/plugin-react';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Playwright owns e2e/ : ses specs répondent au glob par défaut de vitest, qui les collecterait
  // et échouerait. Aucun test unitaire ici, d'où passWithNoTests.
  test: {
    exclude: [...defaultExclude, 'e2e/**'],
    passWithNoTests: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  // The mock live server (packages/shared) can stand in for the real one in dev.
  // Run MOCK=1 pnpm dev to point everything at :4001 — the mock also answers
  // GET /api/v1/join/:code and serves /uploads/mock-sample.svg (lot 1), so no API is needed.
  ...(process.env.MOCK
    ? {
        server: {
          host: '127.0.0.1',
          port: 5173,
          proxy: {
            '/api': { target: 'http://127.0.0.1:4001', changeOrigin: true },
            '/uploads': { target: 'http://127.0.0.1:4001', changeOrigin: true },
            '/socket.io': { target: 'http://127.0.0.1:4001', ws: true },
          },
        },
      }
    : {}),
});
