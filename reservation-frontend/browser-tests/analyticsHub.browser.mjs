import { test, expect } from '@playwright/test';

const HUB = '/browser-tests/index.html?route=/admin/analytics';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

async function pageOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('admin hub links existing pages and does not invent a class BESTEP url', async ({ page }) => {
  await page.goto(`${HUB}&profile=admin`);
  await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動營運總覽' })).toHaveAttribute('href', '/admin/analytics/overview');
  await expect(page.getByRole('link', { name: '班級列表' })).toHaveAttribute('href', '/admin/classes');
  await expect(page.getByRole('link', { name: '資源覆蓋' })).toHaveAttribute('href', '/admin/learning-analytics/resources');
  const hrefs = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs.some((href) => String(href).includes('/bestep'))).toBe(false);
  await expect(page.getByText('三個 Shadow 預設關閉')).toBeVisible();
  await expect(page.getByText('不能解讀成某個活動造成了進步')).toBeVisible();
  await page.getByRole('link', { name: '班級列表' }).click();
  await expect(page.getByText('學期：')).toBeVisible();
});

test('learning-only profile cannot follow operations or class links', async ({ page }) => {
  await page.goto(`${HUB}&profile=learning`);
  await expect(page.getByRole('link', { name: '資源覆蓋' })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動營運總覽' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '班級列表' })).toHaveCount(0);
  await expect(page.getByText('活動營運總覽：沒有權限').first()).toBeVisible();
});

test('office staff profile has no analytics destinations', async ({ page }) => {
  await page.goto(`${HUB}&profile=none`);
  await expect(page.getByRole('heading', { name: '成效分析中心' })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動營運總覽' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '班級列表' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '資源覆蓋' })).toHaveCount(0);
});

test('hub links are keyboard focusable and cards fit the viewport', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${HUB}&profile=admin`);
    const link = page.getByRole('link', { name: '活動營運總覽' });
    await link.focus();
    await expect(link).toBeFocused();
    expect(await pageOverflow(page), viewport.name).toBeLessThanOrEqual(1);
  }
});
