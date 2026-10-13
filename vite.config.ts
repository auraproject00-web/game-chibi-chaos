import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base keeps asset paths working on Vercel and any static host.
  base: './',
  server: { host: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
});
