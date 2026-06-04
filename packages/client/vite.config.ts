import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vite configuration for the React client.
 *
 * Key decisions:
 *
 * 1. `@vitejs/plugin-react` — uses Babel for Fast Refresh (HMR).
 *    Alternatives: plugin-react-swc (faster but less ecosystem support).
 *
 * 2. Path alias `@/` → `src/` — allows clean absolute imports:
 *    `import { Button } from '@/components/ui/Button'`
 *    instead of `../../components/ui/Button`
 *
 * 3. Proxy `/api` → Express server — in development, Vite proxies API
 *    calls to the Express server so we avoid CORS issues and can use
 *    relative API URLs (`/api/v1/...`) in both dev and production.
 *
 * 4. Output to `dist/` — electron-builder expects the built client here.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  server: {
    port: 5173,
    strictPort: true, // Fail instead of trying another port
    proxy: {
      // Proxy /api requests to the Express server during development
      '/api': {
        target: 'http' + '://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Generate source maps for production debugging
    sourcemap: true,
    // Minimum chunk size warning threshold (500KB default → 750KB)
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          // React + routing
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data layer
          'vendor-query': ['@tanstack/react-query', 'axios', 'zustand'],
          // UI utilities
          'vendor-ui': ['recharts', 'lucide-react', 'react-hot-toast'],
        },
      },
    },
  },

  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'zustand'],
  },
});
