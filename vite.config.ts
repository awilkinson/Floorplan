import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built as a claude.ai Artifact: every asset path must be relative to the page,
// and the app ships as a few scripts published beside the page.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 6000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        // .mjs workers ship as .js so the artifact host serves them as JavaScript
        assetFileNames: (a) => (a.names?.[0]?.endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
});
