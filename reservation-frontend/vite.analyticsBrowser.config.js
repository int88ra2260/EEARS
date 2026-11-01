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

// Test-only Vite server. No API proxy, so a missed mock cannot reach port 3000.
export default defineConfig({
  plugins: [jsxInJs(), react()],
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
