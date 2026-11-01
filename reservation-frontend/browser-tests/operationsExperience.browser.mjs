import { test, expect } from '@playwright/test';

const HUB = '/browser-tests/index.html?route=/admin/analytics&profile=admin';
const OVERVIEW = '/browser-tests/index.html?route=/admin/analytics/overview';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

function breakdown(semester) {
  const rows = semester === '114-1' ? 7 : 48;
  return {
    semester,
    items: [{
      eventType: 'English Table',
      totalReservations: rows,
      totalEventCapacity: 40,
      bookingRate: 17.5,
    }],
    byEvent: [],
    summary: { synthetic: true },
  };
}

async function mockAnalytics(page, mode = 'ok') {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/analytics/'))) {
      await route.abort();
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/analytics/**', async (route) => {
    const url = new URL(route.request().url());
    const semester = url.searchParams.get('semester') || '';
    if (mode === 'error' && url.pathname === '/api/analytics/overview') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '總覽載入失敗' }),
      });
      return;
    }
    const body = url.pathname === '/api/analytics/reservation-capacity-breakdown'
      ? breakdown(semester)
      : url.pathname === '/api/analytics/overview'
        ? {
          semester,
          totalReservations: semester === '114-1' ? 7 : 48,
          totalEventCapacity: 40,
          bookingRate: 17.5,
          attendanceRate: 40,
          violationRate: 1,
          englishPassRate: 4,
        }
        : url.pathname === '/api/analytics/trends'
          ? { activityTrend: [] }
          : url.pathname === '/api/analytics/events'
            ? { attendanceTrend: [] }
            : { rankings: [] };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test('hub opens the operations overview and a real activity-list link', async ({ page }) => {
  await mockAnalytics(page);
  await page.goto(HUB);
  await page.getByRole('link', { name: '活動營運總覽' }).click();
  const observation = page.getByTestId('ops-observation');
  await expect(observation).toContainText('預約筆數主要出現在「English Table」');
  await expect(observation).toContainText('預約列');
  await expect(observation).not.toContainText('供給不足');
  const action = page.getByRole('link', { name: '開啟活動列表' });
  await expect(action).toHaveAttribute('href', '/admin/operations');
  await expect(observation).toContainText('請在該頁自行篩選');
  await action.focus();
  await expect(action).toBeFocused();
  await action.click();
  await expect(page.getByRole('heading', { level: 1, name: '活動列表' })).toBeVisible();
});

test('semester change replaces the observation count', async ({ page }) => {
  await mockAnalytics(page);
  await page.goto(`${OVERVIEW}&profile=admin`);
  const observation = page.getByTestId('ops-observation');
  await expect(observation).toContainText('48 筆預約列');
  await page.getByLabel('學期').selectOption('114-1');
  await expect(observation).toContainText('7 筆預約列');
  await expect(observation).not.toContainText('48 筆預約列');
});

test('overview error does not invent an observation', async ({ page }) => {
  await mockAnalytics(page, 'error');
  await page.goto(`${OVERVIEW}&profile=admin`);
  await expect(page.getByRole('alert')).toContainText('總覽載入失敗');
  await expect(page.getByTestId('ops-observation')).toHaveCount(0);
});

test('regular teacher sees the observation without management links', async ({ page }) => {
  await mockAnalytics(page);
  await page.goto(`${OVERVIEW}&profile=teacher`);
  await expect(page.getByTestId('ops-observation')).toContainText('沒有可進入的活動列表');
  await expect(page.getByRole('link', { name: '開啟活動列表' })).toHaveCount(0);
});

test('observation stays inside desktop, tablet, and mobile widths', async ({ page }) => {
  await mockAnalytics(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${OVERVIEW}&profile=admin`);
    await expect(page.getByTestId('ops-observation')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, viewport.name).toBeLessThanOrEqual(1);
  }
});
