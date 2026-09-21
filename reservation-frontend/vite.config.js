import { defineConfig } from 'vitest/config';
import { transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';

// CRA used JSX inside many `.js` files; teach Vite/esbuild to treat them as JSX.
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

const chunkGroups = [
  {
    name: 'vendor-react',
    packages: new Set([
      '@remix-run/router',
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      'scheduler',
    ]),
  },
  {
    name: 'vendor-ui',
    packages: new Set([
      '@restart/hooks',
      '@restart/ui',
      'bootstrap',
      'classnames',
      'dom-helpers',
      'prop-types',
      'react-bootstrap',
      'uncontrollable',
    ]),
  },
  {
    name: 'vendor-animation',
    packages: new Set([
      '@gsap/react',
      'gsap',
      'motion',
    ]),
  },
  {
    name: 'vendor-charts',
    packages: new Set([
      'clsx',
      'd3-array',
      'd3-color',
      'd3-ease',
      'd3-format',
      'd3-interpolate',
      'd3-path',
      'd3-scale',
      'd3-shape',
      'd3-time',
      'd3-time-format',
      'decimal.js-light',
      'eventemitter3',
      'react-is',
      'recharts',
      'tiny-invariant',
      'victory-vendor',
    ]),
  },
  {
    name: 'vendor-editor',
    packages: new Set([
      '@tiptap/core',
      '@tiptap/extension-blockquote',
      '@tiptap/extension-bold',
      '@tiptap/extension-bullet-list',
      '@tiptap/extension-code',
      '@tiptap/extension-code-block',
      '@tiptap/extension-color',
      '@tiptap/extension-document',
      '@tiptap/extension-dropcursor',
      '@tiptap/extension-font-family',
      '@tiptap/extension-gapcursor',
      '@tiptap/extension-hard-break',
      '@tiptap/extension-heading',
      '@tiptap/extension-highlight',
      '@tiptap/extension-history',
      '@tiptap/extension-horizontal-rule',
      '@tiptap/extension-image',
      '@tiptap/extension-italic',
      '@tiptap/extension-link',
      '@tiptap/extension-list-item',
      '@tiptap/extension-ordered-list',
      '@tiptap/extension-paragraph',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-strike',
      '@tiptap/extension-table',
      '@tiptap/extension-table-cell',
      '@tiptap/extension-table-header',
      '@tiptap/extension-table-row',
      '@tiptap/extension-text',
      '@tiptap/extension-text-align',
      '@tiptap/extension-text-style',
      '@tiptap/extension-underline',
      '@tiptap/pm',
      '@tiptap/react',
      '@tiptap/starter-kit',
      'prosemirror-commands',
      'prosemirror-dropcursor',
      'prosemirror-gapcursor',
      'prosemirror-history',
      'prosemirror-keymap',
      'prosemirror-model',
      'prosemirror-schema-list',
      'prosemirror-state',
      'prosemirror-transform',
      'prosemirror-view',
    ]),
  },
  {
    name: 'vendor-xlsx',
    packages: new Set([
      'adler-32',
      'cfb',
      'codepage',
      'crc-32',
      'frac',
      'ssf',
      'wmf',
      'word',
      'xlsx',
    ]),
  },
];

function packageNameFromId(id) {
  const normalized = id.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex === -1) return null;

  const segments = normalized.slice(markerIndex + marker.length).split('/');
  if (!segments[0]) return null;
  return segments[0].startsWith('@') ? `${segments[0]}/${segments[1]}` : segments[0];
}

function manualChunks(id) {
  const packageName = packageNameFromId(id);
  if (!packageName) return undefined;

  const group = chunkGroups.find(({ packages }) => packages.has(packageName));
  return group?.name;
}

// https://vitejs.dev/config/
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
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Keep CRA-compatible output dir for deploy.ps1 → reservation-backend/build
    outDir: 'build',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: true,
  },
});
