import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('review-output/operations-ux-r6');

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

const student = {
  studentId: 'B11000001',
  studentName: '合成學生',
  department: '外文系',
  className: 'ET-A',
  riskScore: 8,
  riskLevel: 'high',
  reasons: [{ key: 'noShow', label: '未到／缺席', value: 3, contribution: 4 }],
};

async function installMocks(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const semester = url.searchParams.get('semester') || '115-1';
    const pathName = url.pathname;
    const quiet = semester === '114-1';

    if (pathName.endsWith('/analytics/overview')) {
      await route.fulfill(json({
        semester,
        totalReservations: quiet ? 0 : 18,
        totalEventCapacity: quiet ? 0 : 40,
        bookingRate: quiet ? 0 : 45,
        attendanceRate: quiet ? null : 50,
        violationRate: quiet ? 0 : 5,
        englishPassRate: 12.5,
      }));
      return;
    }
    if (pathName.endsWith('/reservation-capacity-breakdown')) {
      await route.fulfill(json({
        semester,
        byEventType: quiet ? [] : [{
          eventType: 'English Table',
          totalReservations: 18,
          totalEventCapacity: 28,
          bookingRate: 64.29,
        }, {
          eventType: 'Job Talk',
          totalReservations: 0,
          totalEventCapacity: 12,
          bookingRate: 0,
        }],
        byEvent: quiet ? [] : [{
          eventId: 9,
          eventDate: '2026-09-07',
          eventName: '週一英語桌',
          eventType: 'English Table',
          maxCapacity: 20,
          totalReservations: 18,
          bookingRate: 90,
        }, {
          eventId: 10,
          eventDate: '2026-09-14',
          eventName: '週二寫作諮詢',
          eventType: 'Job Talk',
          maxCapacity: 12,
          totalReservations: 0,
          bookingRate: 0,
        }, {
          eventId: 11,
          eventDate: '2026-09-21',
          eventName: '週三英語桌',
          eventType: 'English Table',
          maxCapacity: 8,
          totalReservations: 0,
          bookingRate: 0,
        }],
      }));
      return;
    }
    if (pathName.endsWith('/analytics/trends')) {
      await route.fulfill(json({
        activityTrend: quiet ? [] : [{ date: '2026-09-07', reservationsCount: 18 }],
      }));
      return;
    }
    if (pathName.endsWith('/analytics/events')) {
      await route.fulfill(json({
        attendanceTrend: quiet ? [] : [{ date: '2026-09-07', attendanceRate: 50 }],
      }));
      return;
    }
    if (pathName.endsWith('/analytics/classes')) {
      await route.fulfill(json({ rankings: quiet ? [] : [{ classId: 1, className: 'ET-A', violationRate: 5 }] }));
      return;
    }
    if (pathName.endsWith('/analytics/risk')) {
      await route.fulfill(json({ risks: quiet ? [] : [student] }));
      return;
    }
    if (pathName.endsWith('/reports/overview') || pathName.endsWith('/reports/high-risk')) {
      const kind = pathName.endsWith('/reports/high-risk') ? 'high-risk' : 'overview';
      await route.fulfill({
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'content-disposition': `attachment; filename="EEARS_${kind}_${semester}_20261103_1200.xlsx"`,
        },
        body: Buffer.from('synthetic-workbook'),
      });
      return;
    }
    await route.fulfill(json({}));
  });
}

async function fits(page) {
  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test('operations overview after the UX pass', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/analytics/overview?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '活動營運總覽' })).toBeVisible();
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('18');
  await expect(page.getByTestId('ops-value-booking')).toHaveText('45.0%');
  await expect(page.getByTestId('ops-value-attendance')).toHaveText('50.0%');
  await page.screenshot({ path: path.join(outDir, 'overview-desktop-after.png'), fullPage: false });

  const session = page.getByTestId('capacity-by-event');
  await session.scrollIntoViewIfNeeded();
  await expect(page.getByRole('link', { name: '週一英語桌' })).toHaveAttribute('href', '/admin/operations/9');
  const sessionCapacity = await session.locator('tbody tr td:nth-child(4)').allTextContents();
  const typeCapacity = await page.getByTestId('capacity-by-type').locator('tbody tr td:nth-child(2)').allTextContents();
  const sum = (values) => values.reduce((total, value) => total + Number(value), 0);
  expect(sum(sessionCapacity)).toBe(40);
  expect(sum(typeCapacity)).toBe(40);
  await page.screenshot({ path: path.join(outDir, 'overview-capacity-consistent.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, 'overview-session-after.png'), fullPage: false });

  await page.getByLabel('學期').selectOption('114-1');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('0');
  await expect(page.getByTestId('ops-value-attendance')).toHaveText('—');
  await expect(page.getByText('查無活動資料')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'overview-semester-after.png'), fullPage: false });
  await fits(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/analytics/overview?profile=admin');
  const sessionLink = page.getByRole('link', { name: '查看這場活動' }).first();
  await sessionLink.scrollIntoViewIfNeeded();
  await expect(sessionLink).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'overview-mobile-after.png'), fullPage: false });
  await fits(page);
});

test('risk monitoring after the UX pass', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/analytics/risk?profile=admin');
  await expect(page.getByRole('heading', { name: '班級名冊高關注名單' })).toBeVisible();
  await expect(page.getByRole('link', { name: '高關注名單', exact: true })).toBeVisible();
  await expect(page.getByText('合成學生')).toBeVisible();
  await expect(page.getByRole('link', { name: '合成學生' })).toHaveAttribute(
    'href',
    /\/admin\/analytics\/student\/B11000001\?fromSemester=115-1/,
  );
  await page.screenshot({ path: path.join(outDir, 'risk-desktop-wording.png'), fullPage: false });
  await page.screenshot({ path: path.join(outDir, 'risk-desktop-after.png'), fullPage: false });

  await page.locator('#risk-semester').selectOption('114-1');
  await expect(page.getByText('沒有符合目前高關注條件的名單')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'risk-empty-after.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/analytics/risk?profile=admin');
  await expect(page.getByTestId('risk-student')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'risk-mobile-after.png'), fullPage: false });
  await fits(page);
});

test('risk request error stays on the page', async ({ page }) => {
  await installMocks(page);
  await page.route('**/api/analytics/risk**', async (route) => {
    await route.fulfill(json({ error: '名單暫時讀不到' }, 500));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/analytics/risk?profile=admin');
  await expect(page.getByText('名單暫時讀不到')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'risk-error-after.png'), fullPage: false });
});

test('a slower risk response does not replace the newer semester', async ({ page }) => {
  await installMocks(page);
  let held = false;
  let release = () => {};
  await page.route('**/api/analytics/risk**', async (route) => {
    const semester = new URL(route.request().url()).searchParams.get('semester');
    if (semester === '115-1') {
      held = true;
      await new Promise((resolve) => {
        release = resolve;
      });
      await route.fulfill(json({
        risks: [{ ...student, studentId: 'SLOW', studentName: '舊回應' }],
      }));
      return;
    }
    await route.fulfill(json({
      risks: [{ ...student, studentId: 'NEW1', studentName: '新學期學生' }],
    }));
  });
  await page.goto('/admin/analytics/risk?profile=admin');
  await expect.poll(() => held).toBe(true);
  await page.locator('#risk-semester').selectOption('114-1');
  await expect(page.getByText('新學期學生')).toBeVisible();
  release();
  await expect(page.getByText('舊回應')).toHaveCount(0);
});

test('reports explain the workbook before download', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/reports?profile=admin');
  await expect(page.getByRole('heading', { name: '活動營運總覽工作簿' })).toBeVisible();
  await expect(page.getByText('下載目前結果')).toHaveCount(0);
  await expect(page.getByTestId('report-download-overview')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'reports-desktop-compact.png'), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/reports?profile=admin');
  const mobileDownload = page.getByTestId('report-download-overview');
  await mobileDownload.scrollIntoViewIfNeeded();
  await expect(mobileDownload).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'reports-mobile-download.png'), fullPage: false });
  await fits(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/reports?profile=admin');
  await page.getByLabel('學期').selectOption('115-1');
  const overviewDownload = page.waitForRequest((request) => request.url().includes('/api/reports/overview'));
  await page.getByTestId('report-download-overview').click();
  expect((await overviewDownload).url()).toContain('semester=115-1&format=xlsx');
  await expect(page.getByText('報表已下載：EEARS_overview_115-1_20261103_1200.xlsx', { exact: true })).toBeVisible();
  const riskDownload = page.waitForRequest((request) => request.url().includes('/api/reports/high-risk'));
  await page.getByTestId('report-download-high-risk').click();
  expect((await riskDownload).url()).toContain('semester=115-1&format=xlsx');
  await expect(page.getByText('報表已下載：EEARS_high-risk_115-1_20261103_1200.xlsx', { exact: true })).toBeVisible();
});

test('reports without export permission stay behind the existing guard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/reports?profile=learning');
  await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
  await page.screenshot({ path: path.join(outDir, 'reports-denied-after.png'), fullPage: false });
});

test('legacy analytics routes still open the overview', async ({ page }) => {
  await installMocks(page);
  await page.goto('/admin/analytics/trends?profile=admin');
  await expect(page).toHaveURL(/\/admin\/analytics\/overview/);
  await expect(page.getByRole('heading', { level: 1, name: '活動營運總覽' })).toBeVisible();
  await page.goto('/admin/analytics/teacher-impact?profile=admin');
  await expect(page).toHaveURL(/\/admin\/analytics\/overview/);
});

test('back and forward keep the operations pages', async ({ page }) => {
  await installMocks(page);
  await page.goto('/admin/analytics/overview?profile=admin');
  await page.goto('/admin/analytics/risk?profile=admin');
  await expect(page.getByText('合成學生')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: '活動營運總覽' })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: '班級名冊高關注名單' })).toBeVisible();
});

test('the pages fit the review viewports', async ({ page }) => {
  await installMocks(page);
  const sizes = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 375, height: 667 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto('/admin/analytics/overview?profile=admin');
    await expect(page.getByTestId('ops-value-reservations')).toBeVisible();
    await fits(page);
    await page.goto('/admin/analytics/risk?profile=admin');
    await expect(page.getByText('合成學生')).toBeVisible();
    await fits(page);
    await page.goto('/admin/reports?profile=admin');
    await expect(page.getByRole('heading', { name: '活動營運總覽工作簿' })).toBeVisible();
    await fits(page);
  }
});
