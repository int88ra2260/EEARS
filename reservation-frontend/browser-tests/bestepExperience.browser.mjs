import { test, expect } from '@playwright/test';

const HUB = '/browser-tests/index.html?route=/admin/analytics&profile=admin';
const BESTEP = '/browser-tests/index.html?route=/admin/classes/SYN-CLASS/bestep&profile=admin';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

function student() {
  return {
    studentId: 'SYN-N1-H',
    studentName: '合成辛',
    department: '合成學系',
    personalRegistration: {
      status: 'success',
      examType: 'LRSW',
      examTypeLabel: '聽讀說寫',
      exemptionType: '無',
      regId: 9,
    },
    groupRegistration: null,
    attendance: {
      L: { attended: true },
      R: { attended: false },
      S: { attended: null },
      W: {},
    },
    score: {
      totalScore: 0,
      listeningScore: 0,
      readingScore: null,
      speakingScore: '',
      writingScore: undefined,
      listeningLevel: 'B2',
      passed: false,
    },
  };
}

function bestepBody() {
  return {
    classInfo: {
      classId: 'SYN-CLASS',
      className: '合成班',
      teacherName: '合成教師',
      semester: '115-1',
    },
    statistics: {
      domesticStudentCount: 1,
      totalStudents: 1,
      registrationRate: 25,
      totalExamCount: 1,
      registrationDenominator: 4,
      attendanceRate: null,
      attendedSlots: 0,
      totalRegistrationExamSlots: 0,
      passedCount: 3,
      passRate: 150,
      avgScore: 0,
    },
    students: [student()],
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
  };
}

async function installApi(page, mode = 'ok') {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'bestep-browser-harness');
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || url.pathname.startsWith('/api/')) {
      if (!local) {
        await route.abort();
        return;
      }
    }
    await route.fallback();
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/admin/classes/overview') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{
            classId: 'SYN-CLASS',
            className: '合成班',
            teacherName: '合成教師',
            studentCount: 1,
            participatedCount: 0,
            coverage: 0,
            attendedCountTotal: 0,
            avgAttendPerStudent: 0,
            noShowCountTotal: 0,
          }],
          pagination: { total: 1, totalPages: 1 },
        }),
      });
      return;
    }
    if (url.pathname === '/api/admin/classes/SYN-CLASS/bestep-overview') {
      if (mode === 'error') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: '合成載入失敗' }),
        });
        return;
      }
      if (mode === 'empty') {
        const body = bestepBody();
        body.students = [];
        body.statistics = null;
        body.pagination = { page: 1, pageSize: 50, total: 0, totalPages: 0 };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bestepBody()),
      });
      return;
    }
    await route.abort();
  });
}

test('hub opens the real class list and that class BESTEP page', async ({ page }) => {
  await installApi(page);
  await page.goto(HUB);
  await page.getByRole('link', { name: '班級列表' }).click();
  await expect(page.getByRole('button', { name: '查看 BESTEP 分析' })).toBeVisible();
  const hrefs = await page.locator('a').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')));
  expect(hrefs.some((href) => String(href).includes('/bestep'))).toBe(false);
  await page.getByRole('button', { name: '查看 BESTEP 分析' }).click();
  await expect(page.getByRole('heading', { name: '合成班' })).toBeVisible();
  const reading = page.getByTestId('bestep-reading');
  await expect(reading).toContainText('150%');
  await expect(reading).toContainText('尚未核准為官方達標率');
  await expect(reading).toContainText('未確認與未匯入不同');
  await expect(reading).not.toContainText('造成能力');
  await expect(page.getByRole('row').filter({ hasText: 'SYN-N1-H' })).toContainText('總分: 0');
  await expect(page.getByText('S: 未確認')).toBeVisible();
  const exportButton = page.getByRole('button', { name: '匯出 BESTEP Excel' });
  await exportButton.focus();
  await expect(exportButton).toBeFocused();
  await page.getByRole('button', { name: '查看詳情' }).click();
  await expect(page.getByText(/聽力:\s*0/)).toBeVisible();
  await expect(page.getByText('L 出席')).toBeVisible();
  await expect(page.getByText('R 缺席')).toBeVisible();
  await expect(page.getByText('S 未確認')).toBeVisible();
  await expect(page.getByText('W 未確認')).toBeVisible();
  await page.getByRole('button', { name: '關閉' }).click();
  await page.getByRole('button', { name: '返回班級列表' }).click();
  await expect(page.getByRole('button', { name: '查看 BESTEP 分析' })).toBeVisible();
});

test('direct class page keeps an error and an empty roster from inventing a rate', async ({ page }) => {
  await installApi(page, 'error');
  await page.goto(BESTEP);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText('150%');
  await expect(page.getByTestId('bestep-reading')).toContainText('不另算通過比例');
  await expect(page.getByTestId('bestep-reading')).not.toContainText('150%');

  await installApi(page, 'empty');
  await page.goto(BESTEP);
  await expect(page.getByText('沒有找到符合條件的資料')).toBeVisible();
  await expect(page.getByTestId('bestep-reading')).toContainText('不另算通過比例');
});

test('class BESTEP reading stays inside desktop, tablet, and mobile widths', async ({ page }) => {
  await installApi(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(BESTEP);
    await expect(page.getByTestId('bestep-reading')).toBeVisible();
    const overflow = await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ));
    expect(overflow, viewport.name).toBeLessThanOrEqual(1);
    const table = page.locator('.table-responsive');
    await expect(table).toBeVisible();
  }
});
