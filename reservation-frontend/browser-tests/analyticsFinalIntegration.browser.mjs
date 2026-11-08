import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('review-output/analytics-final-integration');

async function installApi(page) {
  await page.route('**/api/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: false,
  });
}

async function noPageOverflow(page) {
  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await installApi(page);
});

async function expandSection(sidebar, name) {
  const section = sidebar.getByRole('button', { name, exact: true });
  await section.scrollIntoViewIfNeeded();
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
}

test('consolidated navigation keeps legacy urls and separates workspaces', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/analytics?profile=admin');
  const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
  await expandSection(sidebar, '學習歷程與成果');
  await expandSection(sidebar, '學習成效');
  await expandSection(sidebar, '上呈');
  await expandSection(sidebar, '看資源');
  await expect(sidebar.getByRole('link', { name: '學習成效概況' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '活動營運總覽' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '高關注名單' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '營運報表下載' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: '資源覆蓋' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: '系所比較' })).toHaveCount(0);
  await shot(page, 'sidebar-desktop.png');

  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'BESTEP 數據分析' })).toHaveAttribute('href', '/admin/english-test?tab=analytics');
  await expect(main.getByRole('link', { name: '資源與開課' })).toHaveAttribute('href', '/admin/learning-analytics/resources');
  await expect(main.getByRole('link', { name: '群體與技能比較' })).toHaveAttribute('href', '/admin/learning-analytics/cohorts');
  await expect(main.getByRole('link', { name: '課／師／活動' })).toHaveCount(0);
  await shot(page, 'hub-operations-bestep.png');
  await main.getByRole('link', { name: '找學生' }).scrollIntoViewIfNeeded();
  await shot(page, 'hub-entries.png');

  await main.getByRole('link', { name: '學習成效概況' }).click();
  await expect(page).toHaveURL(/\/admin\/learning-analytics\/overview/);
  await expect(page.getByRole('heading', { level: 1, name: '學習成效概況' })).toBeVisible();
  await expect(page.getByText('分析範圍：學習成效快照')).toBeVisible();
  await expect(page.locator('.outcomes-mode').getByRole('link', { name: '學期 B2 KPI' })).toBeVisible();
  await page.getByRole('heading', { level: 1, name: '學習成效概況' }).scrollIntoViewIfNeeded();
  await shot(page, 'outcomes-nav.png');
  await page.locator('.outcomes-mode').getByRole('link', { name: '學期 B2 KPI' }).click();
  await expect(page).toHaveURL(/\/kpi-report/);
  await expect(page.getByRole('heading', { level: 1, name: '學期 B2 KPI' })).toBeVisible();

  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toBeVisible();
  await expect(page.getByRole('link', { name: '參與與覆蓋' })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'resources-workspace.png');
  await page.goto('/admin/learning-analytics/offerings?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toBeVisible();
  await expect(page.getByRole('link', { name: '課程與活動觀察' })).toHaveAttribute('aria-current', 'page');

  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '群體與技能比較' })).toBeVisible();
  await expect(page.getByRole('link', { name: '群體比較' })).toHaveAttribute('aria-current', 'page');
  await shot(page, 'comparison-workspace.png');
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '群體與技能比較' })).toBeVisible();
  await expect(page.getByRole('link', { name: '技能成長' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/admin/learning-analytics/raw-data?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '資料匯出' })).toBeVisible();

  await page.goto('/admin/learning-analytics/explore?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
  await page.goto('/admin/analytics/trends?profile=admin');
  await expect(page).toHaveURL(/\/admin\/analytics\/overview/);
  await expect(page.getByRole('heading', { level: 1, name: '活動營運總覽' })).toBeVisible();

  await page.goto('/admin/english-test?tab=analytics&profile=admin');
  await expect(page.getByRole('tab', { name: '數據分析' })).toHaveAttribute('aria-selected', 'true');

  await page.goto('/admin/reports?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '營運報表下載' })).toBeVisible();
  await expect(page.getByRole('button', { name: /下載這份 Excel/ }).first()).toBeVisible();
  await expect(page.getByText('不是活動營運總覽畫面的逐列存檔')).toBeHidden();
  await shot(page, 'operations-reports.png');
  await noPageOverflow(page);
});

test('a profile without analytics permission cannot open protected workspaces', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/analytics?profile=none');
  await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
  await expect(page.getByRole('link', { name: '活動營運總覽' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '高關注名單' })).toHaveCount(0);
  await shot(page, 'denied-nav.png');

  await page.goto('/admin/analytics/risk?profile=none');
  await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '班級名冊高關注名單' })).toHaveCount(0);

  await page.goto('/admin/learning-analytics/raw-data?profile=learning');
  await expect(page.getByRole('heading', { level: 1, name: '資料匯出' })).toBeVisible();
  await expect(page.getByRole('button', { name: '匯出 XLSX' })).toBeDisabled();
});

test('mobile navigation wraps and reaches another workspace', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/analytics?profile=admin');
  await page.getByRole('button', { name: '選單' }).click();
  const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
  await expandSection(sidebar, '學習歷程與成果');
  await expandSection(sidebar, '學習成效');
  await expandSection(sidebar, '看資源');
  const resourceLink = sidebar.getByRole('link', { name: '資源與開課' });
  await resourceLink.scrollIntoViewIfNeeded();
  await expect(resourceLink).toBeVisible();
  await shot(page, 'mobile-nav.png');
  await sidebar.getByRole('link', { name: '資源與開課' }).click();
  await expect(page).toHaveURL(/\/admin\/learning-analytics\/resources/);
  await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toBeVisible();
  await noPageOverflow(page);

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/admin/analytics?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
  await noPageOverflow(page);
});
