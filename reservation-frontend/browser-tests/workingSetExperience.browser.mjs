import { test, expect } from '@playwright/test';

const ROUTE = '/browser-tests/index.html?route=/admin/learning-analytics/working-set-probe&profile=learning';

const journey = {
  success: true,
  data: {
    student: {
      studentId: 'S100',
      department: '合成學系',
      cohort: '114',
    },
    timeline: [
      {
        eventId: 'exam-1',
        lane: 'exam',
        eventDate: '2026-03-01',
        title: '聽力',
        skill: 'listening',
        rawScore: null,
        cefrLevel: 'B1',
        hours: null,
      },
      {
        eventId: 'course-1',
        lane: 'course',
        eventDate: '2026-04-01',
        title: '通識英文',
        hours: 18,
        rawScore: null,
      },
    ],
    meta: { snapshotVersion: 'synthetic-snapshot', warnings: [] },
  },
};

async function installMocks(page) {
  const leaked = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.port === '3000') leaked.push(request.url());
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '3000') {
      await route.abort();
      return;
    }
    if (url.pathname.includes('/students/S100/journey')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(journey),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
  return leaked;
}

test.describe('working set and student drawer', () => {
  test('pause, reapply, clear, and keep the list while the drawer is open', async ({ page }) => {
    const leaked = await installMocks(page);
    await page.goto(ROUTE);
    await page.getByRole('button', { name: '帶入群體' }).click();
    await expect(page.getByTestId('la-working-set')).toContainText('目前正在分析特定學生群體');
    await expect(page.getByTestId('la-working-set')).toContainText('課Ａ學生（1 人）');
    await expect(page.getByRole('button', { name: '清除群體篩選' })).toBeVisible();
    await expect(page.getByRole('button', { name: '看全部' })).toHaveCount(0);

    await page.getByLabel('學期').selectOption('115-1');
    await expect(page.getByTestId('la-working-set')).toContainText('尚未套用這份固定名單');
    await page.getByRole('button', { name: '沿用這份固定名單' }).click();
    await expect(page.getByTestId('la-working-set')).toContainText('固定名單');
    await expect(page.getByTestId('la-working-set')).toContainText('沒有依這頁條件重篩');

    await page.getByRole('button', { name: '打開抽屜' }).click();
    await expect(page.getByRole('dialog', { name: '學生明細' })).toContainText('待補');
    await expect(page.getByRole('dialog', { name: '學生明細' })).toContainText('沒有原始分');
    await expect(page.getByRole('heading', { name: '群體篩選探針' })).toBeVisible();
    await page.getByRole('button', { name: '關閉', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '學生明細' })).toHaveCount(0);
    await expect(page.getByText('名單仍在這一頁。')).toBeVisible();

    await page.getByRole('button', { name: '清除群體篩選' }).click();
    await expect(page.getByTestId('la-working-set')).toHaveCount(0);
    expect(leaked).toEqual([]);
  });

  test('the drawer fits a narrow viewport', async ({ page }) => {
    await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTE);
    await page.getByRole('button', { name: '打開抽屜' }).click();
    const drawer = page.getByRole('dialog', { name: '學生明細' });
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    await expect(page.getByText('名單仍在這一頁。')).toBeVisible();
  });
});
