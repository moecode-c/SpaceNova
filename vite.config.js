import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Keep the heavy libraries in their own chunks so a screen that does not
    // draw a chart or a map never pays for one.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          geo: ['d3-geo', 'topojson-client', 'world-atlas/countries-110m.json'],
          orbital: ['satellite.js'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
