import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  // Pre-bundle up front: mediabunny is only imported from the encoder worker, and discovering it
  // lazily makes the dev server reload the page in the middle of the first export.
  optimizeDeps: { include: ['mediabunny', 'maplibre-gl'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
