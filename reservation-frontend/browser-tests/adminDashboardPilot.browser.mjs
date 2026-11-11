import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
  { name: '375', width: 375, height: 667 },
];

function localYmd(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function fulfillJson(route, body) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installDashboardApis(page) {
  const today = localYmd();
  const utcDay = new Date().toISOString().slice(0, 10);
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/api/health') {
      await fulfillJson(route, {
        status: 'ok',
        services: {
          db: { status: 'ok', latencyMs: 35 },
          email: { status: 'ok', latencyMs: 650 },
        },
      });
      return;
    }
    if (pathname === '/api/reservations') {
      await fulfillJson(route, [{ createdAt: `${utcDay}T00:30:00.000Z` }]);
      return;
    }
    if (pathname === '/api/events') {
      await fulfillJson(route, [
        { id: 7, name: 'English Table', date: today, startTime: '10:00', endTime: '11:00' },
      ]);
      return;
    }
    if (pathname === '/api/english-test/registrations/metrics/pending-count') {
      await fulfillJson(route, { count: 2 });
      return;
    }
    if (pathname.startsWith('/api/admin/announcements')) {
      await fulfillJson(route, { items: [], pagination: { total: 0 } });
      return;
    }
    if (pathname.startsWith('/api/blacklist')) {
      await fulfillJson(route, { success: true, data: [] });
      return;
    }
    await fulfillJson(route, {});
  });
}

async function openDashboard(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await installDashboardApis(page);
  await page.goto('/browser-tests/dashboard.html');
  await expect(page.getByText('部分異常')).toBeVisible();
  await expect(page.getByRole('link', { name: '前往簽到／管理' })).toBeVisible();
}

function contrastRatio(fg, bg) {
  const lum = (rgb) => {
    const parts = rgb.match(/\d+/g).slice(0, 3).map(Number);
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = parts.map(channel);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hi = Math.max(lum(fg), lum(bg));
  const lo = Math.min(lum(fg), lum(bg));
  return (hi + 0.05) / (lo + 0.05);
}

for (const viewport of VIEWPORTS) {
  test(`dashboard pilot fits and stays readable at ${viewport.name}px`, async ({ page }) => {
    await openDashboard(page, viewport);

    const metrics = await page.locator('.admin-dashboard').evaluate((node) => {
      const dashboardOverflow = node.scrollWidth - node.clientWidth;
      const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const primary = node.querySelector('.admin-dashboard__btn--primary');
      const secondary = node.querySelector('.admin-dashboard__btn--secondary');
      const partial = [...node.querySelectorAll('.admin-dashboard__status--partial')]
        .find((el) => el.textContent.includes('部分異常'));
      const primaryStyle = getComputedStyle(primary);
      const secondaryStyle = getComputedStyle(secondary);
      const partialStyle = getComputedStyle(partial);
      const card = partial.closest('.card');
      return {
        dashboardOverflow,
        pageOverflow,
        primaryCount: node.querySelectorAll('.admin-dashboard__btn--primary').length,
        primaryBg: primaryStyle.backgroundColor,
        primaryColor: primaryStyle.color,
        secondaryBg: secondaryStyle.backgroundColor,
        partialColor: partialStyle.color,
        partialBg: getComputedStyle(card).backgroundColor,
      };
    });

    expect(metrics.dashboardOverflow).toBeLessThanOrEqual(1);
    expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
    expect(metrics.primaryCount).toBe(1);
    expect(metrics.primaryBg).toBe('rgb(42, 93, 159)');
    expect(metrics.primaryColor).toBe('rgb(255, 255, 255)');
    expect(metrics.secondaryBg).not.toBe(metrics.primaryBg);
    expect(contrastRatio(metrics.partialColor, metrics.partialBg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(metrics.primaryColor, metrics.primaryBg)).toBeGreaterThanOrEqual(4.5);
  });
}

test('dashboard primary action opens operations and refresh stays available', async ({ page }) => {
  await openDashboard(page, VIEWPORTS[0]);
  await page.getByRole('button', { name: '更新今日預約數' }).click();
  await expect(page.getByRole('button', { name: '更新今日預約數' })).toBeEnabled();
  await page.getByRole('link', { name: '前往簽到／管理' }).click();
  await expect(page.getByText('operations-placeholder')).toBeVisible();
});
