import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

/**
 * Evidence scope (Phase 6D/6E):
 * - Proves production Vite config + build output do not ship harness entry / synthetic auth helpers.
 * - Proves src login/admin boot paths do not import browser harness modules.
 * - Proves shipped web.config is IIS→Node reverse proxy, not the Vite test SPA fallback.
 * - Does NOT prove remote IIS behavior, real staff login, or Staging E2E.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
const srcDir = path.join(root, 'src');
const viteProd = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
const viteAnalytics = fs.readFileSync(path.join(root, 'vite.analyticsBrowser.config.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'browser-tests', 'app.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const HARNESS_NEEDLES = [
  'encodeHarnessToken',
  'applyHarnessAuth',
  'harnessProfilePayload',
  'browser-tests/app-main',
  'browser-tests/app.html',
  'analytics-browser-harness',
  'analytics-app-spa-fallback',
];

function walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function collectHits(files, needles) {
  const hits = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const needle of needles) {
      if (text.includes(needle)) hits.push(`${path.relative(root, file)}:${needle}`);
    }
  }
  return hits;
}

describe('production build isolation from analytics browser harness', () => {
  test('production vite entry and scripts stay on official app, not harness', () => {
    expect(viteProd).not.toContain('analytics-app-spa-fallback');
    expect(viteProd).not.toContain('browser-tests/app.html');
    expect(viteProd).not.toContain('browser-tests/app-main');
    expect(viteAnalytics).toContain('analytics-app-spa-fallback');
    expect(viteAnalytics).toContain('browser-tests/app.html');

    expect(indexHtml).toMatch(/src=["']\/src\/index\.jsx?["']/);
    expect(indexHtml).not.toContain('browser-tests');
    expect(appHtml).toContain('app-main.jsx');

    expect(pkg.scripts.build).toBe('vite build');
    expect(pkg.scripts.start).toBe('vite');
    expect(pkg.scripts['test:analytics-browser']).toContain('playwright.analytics.config.mjs');
  });

  test('production source login/boot paths do not import synthetic harness auth', () => {
    const loginCandidates = [
      path.join(srcDir, 'pages', 'LoginPage.jsx'),
      path.join(srcDir, 'pages', 'LoginPage.js'),
      path.join(srcDir, 'components', 'Login.js'),
      path.join(srcDir, 'components', 'Login.jsx'),
      path.join(srcDir, 'components', 'LoginPage.js'),
      path.join(srcDir, 'components', 'LoginPage.jsx'),
      path.join(srcDir, 'App.js'),
      path.join(srcDir, 'App.jsx'),
      path.join(srcDir, 'index.js'),
      path.join(srcDir, 'index.jsx'),
    ].filter((file) => fs.existsSync(file));

    expect(loginCandidates.length).toBeGreaterThan(0);
    expect(collectHits(loginCandidates, HARNESS_NEEDLES)).toEqual([]);

    // Broad scan is intentional but can exceed default timeouts on cold CI disks.
    const productionSources = walkFiles(srcDir).filter((file) => /\.(js|jsx)$/i.test(file));
    const hits = collectHits(productionSources, [
      'encodeHarnessToken',
      'applyHarnessAuth',
      'harnessProfilePayload',
      'browser-tests/appAuth',
      'browser-tests/app-main',
      'analytics-app-spa-fallback',
    ]);
    expect(hits).toEqual([]);
  }, 60000);

  test('current production build output has no harness entry or synthetic auth helpers', () => {
    if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
      // Default CI order is unit tests before production build; run this file after `npm run build`.
      return;
    }
    expect(fs.existsSync(path.join(buildDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(buildDir, 'browser-tests'))).toBe(false);
    expect(fs.existsSync(path.join(buildDir, 'app.html'))).toBe(false);

    const builtIndex = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
    expect(builtIndex).not.toContain('browser-tests');
    expect(builtIndex).not.toContain('app-main');
    expect(builtIndex).toMatch(/assets\/index-.*\.js/);

    const files = walkFiles(buildDir).filter((file) => /\.(html|js|css|map)$/i.test(file));
    expect(collectHits(files, HARNESS_NEEDLES)).toEqual([]);
  });

  test('shipped web.config is IIS reverse-proxy to Node, not Vite test SPA fallback', () => {
    const publicConfig = fs.readFileSync(path.join(root, 'public', 'web.config'), 'utf8');
    const builtConfigPath = path.join(buildDir, 'web.config');
    const configs = [publicConfig];
    if (fs.existsSync(builtConfigPath)) {
      configs.push(fs.readFileSync(builtConfigPath, 'utf8'));
    }

    for (const config of configs) {
      expect(config).toContain('ReverseProxyToNode');
      expect(config).toContain('http://127.0.0.1:3000/');
      expect(config).toContain('IsFile');
      expect(config).not.toContain('analytics-app-spa-fallback');
      expect(config).not.toContain('browser-tests/app.html');
      expect(config).not.toContain('encodeHarnessToken');
    }
  });
});
