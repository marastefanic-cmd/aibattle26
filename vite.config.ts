import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: { outDir: '../dist/client', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3210', changeOrigin: true },
      // Assistant terminals live in the separate terminal host process.
      '/term': { target: 'ws://127.0.0.1:3211', ws: true, changeOrigin: true },
    },
  },
});
