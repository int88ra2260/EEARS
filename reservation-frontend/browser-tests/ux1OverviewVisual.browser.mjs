import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

/**
 * Phase UX-1 visual capture + interaction acceptance for AdminAnalyticsPage.
 * Uses synthetic analytics routes only (same isolation pattern as adminAnalytics.browser.mjs).
 *
 * Set UX1_CAPTURE_PHASE=before|after to choose screenshot folder.
 * Default: after
 */

const HARNESS = '/browser-tests/index.html';
const PHASE = process.env.UX1_CAPTURE_PHASE === 'before' ? 'before' : 'after';
const OUT_DIR = path.resolve(`browser-tests/ux1-artifacts/${PHASE}`);
const ALLOWED_API = new Set([
  '/api/analytics/overview',
  '/api/analytics/reservation-capacity-breakdown',
  '/api/analytics/trends',
  '/api/analytics/events',
  '/api/analytics/classes',
]);
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-375', width: 375, height: 667 },
];

function overviewBody(semester) {
  if (semester === '114-1') {
    return {
      semester,
      totalReservations: 7,
      totalEventCapacity: 40,
      bookingRate: 17.5,
      attendanceRate: 40,
      violationRate: 1,
      englishPassRate: 4,
    };
  }
  return {
    semester,
    totalReservations: 48,
    totalEventCapacity: 80,
    bookingRate: 60,
    attendanceRate: 75,
    violationRate: 2.5,
    englishPassRate: 11,
  };
}

function payloadFor(pathname, semester, mode) {
  if (mode === 'error' && pathname === '/api/analytics/overview') {
    return null;
  }
  if (mode === 'empty') {
    if (pathname === '/api/analytics/overview') {
      return {
        semester,
        totalReservations: 0,
        totalEventCapacity: 0,
        bookingRate: 0,
        attendanceRate: 0,
        violationRate: 0,
        englishPassRate: 0,
      };
    }
    if (pathname === '/api/analytics/reservation-capacity-breakdown') {
      return { semester, items: [], byEventType: [], byEvent: [], summary: null };
    }
    if (pathname === '/api/analytics/trends') return { activityTrend: [] };
    if (pathname === '/api/analytics/events') return { attendanceTrend: [] };
    return { rankings: [] };
  }
  if (pathname === '/api/analytics/overview') return overviewBody(semester);
  if (pathname === '/api/analytics/reservation-capacity-breakdown') {
    return {
      semester,
      items: [{
        eventType: 'English Table',
        totalEventCapacity: semester === '114-1' ? 40 : 80,
        totalReservations: semester === '114-1' ? 7 : 48,
        bookingRate: semester === '114-1' ? 17.5 : 60,
      }],
      byEventType: [{
        eventType: 'English Table',
        totalEventCapacity: semester === '114-1' ? 40 : 80,
        totalReservations: semester === '114-1' ? 7 : 48,
        bookingRate: semester === '114-1' ? 17.5 : 60,
      }],
      byEvent: [{
        eventId: 'event-a',
        eventDate: '2026-03-02',
        eventName: semester === '114-1' ? '週二桌' : '週一桌',
        eventType: 'English Table',
        maxCapacity: 20,
        totalReservations: semester === '114-1' ? 7 : 6,
        bookingRate: 30,
      }],
      summary: { synthetic: true },
    };
  }
  if (pathname === '/api/analytics/trends') {
    return {
      activityTrend: [
        { date: '2026-03-02', reservationsCount: 5 },
        { date: '2026-03-09', reservationsCount: 3 },
      ],
    };
  }
  if (pathname === '/api/analytics/events') {
    return {
      attendanceTrend: [
        { date: '2026-03-02', attendanceRate: 75 },
        { date: '2026-03-09', attendanceRate: 50 },
      ],
    };
  }
  return {
    rankings: Array.from({ length: 5 }, (_, index) => ({
      classId: index + 1,
      className: `班${String(index + 1).padStart(2, '0')}`,
      violationRate: 10 - index,
      attendanceRate: 80,
      reservationsCount: 4,
    })),
  };
}

async function installIsolation(page, mode = 'normal') {
  const state = { mode, calls: [], blocked: [], consoleErrors: [], pageErrors: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => state.pageErrors.push(String(error)));

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/analytics/'))) {
      state.blocked.push(url.href);
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/analytics/**', async (route) => {
    const url = new URL(route.request().url());
    const semester = url.searchParams.get('semester') || '114-2';
    state.calls.push({ path: url.pathname, semester, kind: url.searchParams.get('kind') });
    if (!ALLOWED_API.has(url.pathname)) {
      state.blocked.push(url.href);
      await route.fulfill({ status: 599, body: 'unexpected' });
      return;
    }
    if (state.mode === 'error' && url.pathname === '/api/analytics/overview') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '總覽載入失敗' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payloadFor(url.pathname, semester, state.mode)),
    });
  });

  return state;
}

async function openOverview(page, mode = 'normal') {
  const state = await installIsolation(page, mode);
  await page.goto(HARNESS);
  await expect(page.getByText('活動營運總覽')).toBeVisible();
  return state;
}

test.describe(`UX-1 overview visual (${PHASE})`, () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  for (const vp of VIEWPORTS) {
    test(`capture ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const state = await openOverview(page, 'normal');
      await page.getByLabel('學期').selectOption('114-2');
      await expect(page.getByTestId('ops-value-reservations')).toHaveText('48');
      await expect.poll(async () => page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(1);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, `overview-${vp.name}.png`),
        fullPage: true,
      });
      expect(state.blocked).toEqual([]);
      expect(state.pageErrors).toEqual([]);
    });
  }
});

test('UX-1 interactions: filter, note, refresh, hub, error, empty', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const state = await openOverview(page, 'normal');

  await page.getByLabel('學期').selectOption('114-1');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('7');
  await expect(page.getByTestId('ops-context')).toContainText('114-1');

  await page.getByRole('button', { name: '重新整理' }).click();
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('7');

  const capacityNote = page.getByRole('button', { name: '活動總名額說明' });
  await capacityNote.click();
  await expect(capacityNote).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/不是場次數/)).toBeVisible();

  await expect(page.getByTestId('ops-observation')).toBeVisible();
  await expect(page.getByRole('heading', { name: '活動趨勢（依活動日期）' })).toBeVisible();
  await expect(page.getByTestId('capacity-by-type')).toContainText('English Table');

  const hub = page.getByRole('link', { name: /成效分析中心|返回成效分析中心/ });
  if (await hub.count()) {
    await expect(hub.first()).toBeVisible();
  }

  // Error mode
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const errState = await openOverview(page, 'error');
  await expect(page.getByRole('alert').filter({ hasText: '總覽載入失敗' })).toBeVisible();
  await expect(page.getByTestId('ops-value-reservations')).toHaveCount(0);
  expect(errState.pageErrors).toEqual([]);

  // Empty/zero mode
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const emptyState = await openOverview(page, 'empty');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('0');
  await expect(page.getByRole('alert').filter({ hasText: '皆為 0' })).toBeVisible();
  await expect(page.getByText('尚無足夠資料產生圖表')).toBeVisible();

  const noise = /favicon|500 \(Internal Server Error\)/i;
  expect(state.consoleErrors.filter((t) => !noise.test(t))).toEqual([]);
  expect(errState.consoleErrors.filter((t) => !noise.test(t))).toEqual([]);
  expect(emptyState.consoleErrors.filter((t) => !noise.test(t))).toEqual([]);
});
