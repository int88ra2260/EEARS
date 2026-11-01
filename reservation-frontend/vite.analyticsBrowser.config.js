import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

function jsxInJs() {
  return {
    name: 'jsx-in-js',
    async transform(code, id) {
      if (!id.match(/[/\\]src[/\\].*\.js$/)) return null;
      return transformWithEsbuild(code, id, {
        loader: 'jsx',
        jsx: 'automatic',
      });
    },
  };
}

function analyticsAppSpaFallback() {
  return {
    name: 'analytics-app-spa-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        const path = url.split('?')[0];
        if (
          path === '/login'
          || path.startsWith('/admin')
        ) {
          const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
          req.url = `/browser-tests/app.html${query}`;
        }
        next();
      });
    },
  };
}

// Test-only Vite server. No API proxy, so a missed mock cannot reach port 3000.
export default defineConfig({
  plugins: [jsxInJs(), react(), analyticsAppSpaFallback()],
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3017,
    strictPort: true,
  },
});
