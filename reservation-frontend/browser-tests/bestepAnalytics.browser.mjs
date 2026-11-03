import { test, expect } from '@playwright/test';

const phase = process.env.UX_BESTEP_PHASE === 'before' ? 'before' : 'after';
const OUT = 'review-output/bestep-ux';
const PAGE = '/admin/english-test?tab=analytics&profile=admin';

const analyticsBody = {
  semester: '114-2',
  activeSemester: '115-1',
  availableSemesters: ['115-1', '114-2', '113-2'],
  semesterCounts: { '114-2': 120, '113-2': 98 },
  grade: {
    total: 100,
    data: [
      { label: '一年級', count: 40 },
      { label: '二年級', count: 35 },
      { label: '三年級', count: 25 },
    ],
  },
  department: {
    total: 100,
    data: [
      { label: '合成學系', count: 60 },
      { label: '外文系', count: 40 },
    ],
  },
  infoSource: {
    total: 90,
    data: [
      { label: '同學告知', count: 50 },
      { label: '課程宣導', count: 40 },
    ],
  },
  registrationSummary: {
    rowCount: 120,
    distinctStudentCount: 120,
    successStudentCount: 96,
    examPopulationStudentCount: 90,
    byExamType: { LRSW: 70, LR: 20, SW: 15, NON: 10, other: 5 },
  },
  attendance: {
    importStatus: 'imported',
    confirmedAttendance: false,
    presentLabel: '匯入紀錄標示出席，來源尚待確認',
    ignoredAggregateRows: 4,
    unmatchedImportRows: 2,
    skills: {
      L: { eligible: 80, imported: 70, markedPresent: 60, markedAbsent: 10, missingRecord: 10, status: 'imported' },
      R: { eligible: 80, imported: 68, markedPresent: 50, markedAbsent: 18, missingRecord: 12, status: 'imported' },
      S: { eligible: 40, imported: 30, markedPresent: 22, markedAbsent: 8, missingRecord: 10, status: 'imported' },
      W: { eligible: 40, imported: 26, markedPresent: 16, markedAbsent: 10, missingRecord: 14, status: 'imported' },
    },
  },
  scores: {
    importStatus: 'imported',
    cefrResolutionNote: '圖上是匯入後保存的等級。未達 A1 會記成 A1；加號會拿掉，所以 B2+ 存成 B2，不會變成 C1。C1 與 C2 原樣保留。不能還原更細的等級。',
    skills: {
      listening: {
        label: '聽力', withScore: 50, missingAmongEligible: 30, eligible: 80,
        cefr: { A1: 5, A2: 8, B1: 12, B2: 20, C1: 3, C2: 1, unrecognized: 0, missing: 1 },
        b2LevelCount: 20, b2OrAboveCount: 24, denominator: 50, status: 'imported',
      },
      reading: {
        label: '閱讀', withScore: 40, missingAmongEligible: 40, eligible: 80,
        cefr: { A1: 4, A2: 6, B1: 10, B2: 16, C1: 2, C2: 1, unrecognized: 0, missing: 1 },
        b2LevelCount: 16, b2OrAboveCount: 19, denominator: 40, status: 'imported',
      },
      speaking: {
        label: '口說', withScore: 20, missingAmongEligible: 20, eligible: 40,
        cefr: { A1: 2, A2: 3, B1: 5, B2: 8, C1: 1, C2: 0, unrecognized: 0, missing: 1 },
        b2LevelCount: 8, b2OrAboveCount: 9, denominator: 20, status: 'imported',
      },
      writing: {
        label: '寫作', withScore: 18, missingAmongEligible: 22, eligible: 40,
        cefr: { A1: 2, A2: 3, B1: 4, B2: 7, C1: 1, C2: 0, unrecognized: 0, missing: 1 },
        b2LevelCount: 7, b2OrAboveCount: 8, denominator: 18, status: 'imported',
      },
    },
  },
};

const emptyBody = {
  semester: '114-2',
  activeSemester: '114-2',
  availableSemesters: ['114-2'],
  semesterCounts: { '114-2': 0 },
  grade: { total: 0, data: [] },
  department: { total: 0, data: [] },
  infoSource: { total: 0, data: [] },
};

async function installMocks(page) {
  const state = { mode: 'ready', release: null };
  const leaked = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.port === '3000') leaked.push(request.url());
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '3000' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.abort();
      return;
    }
    if (url.pathname.endsWith('/stats/analytics')) {
      if (state.mode === 'loading') {
        await new Promise((resolve) => {
          state.release = resolve;
        });
      }
      if (state.mode === 'error') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: '合成統計失敗' }) });
        return;
      }
      const body = state.mode === 'empty' ? emptyBody : analyticsBody;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return { state, leaked };
}

const shotPrefix = phase === 'after' ? 'integration-after' : phase;

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${shotPrefix}-${name}.png`, fullPage: false });
}

test.describe('BESTEP registration analytics', () => {
  test('shows the real analytics tab', async ({ page }) => {
    test.setTimeout(90000);
    const { leaked } = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    if (phase === 'before') {
      await expect(page.getByRole('heading', { name: '數據分析' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '年級分布' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: '培力英檢數據分析' })).toBeVisible();
      await expect(page.getByText('目前查看：114 學年第 2 學期')).toBeVisible();
      await expect(page.locator('.et-analytics-range')).not.toContainText('（目前）');
      await expect(page.locator('option[value="115-1"]')).toContainText('目前學期');
      await expect(page.locator('option[value="114-2"]')).not.toContainText('目前');
      await expect(page.getByText('120', { exact: true })).toBeVisible();
      await expect(page.getByText('一年級')).toBeVisible();
      await expect(page.getByText('96', { exact: true })).toBeVisible();
      await expect(page.getByText('尚未統計', { exact: true })).toHaveCount(0);
      await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
      await page.waitForFunction(() => {
        const node = document.querySelector('.recharts-bar-rectangle');
        if (!node) return false;
        const box = node.getBoundingClientRect();
        return box.height > 24 || box.width > 24;
      });
    }
    await shot(page, 'desktop-1440');
    if (phase === 'after') {
      await page.locator('.et-analytics-plot').scrollIntoViewIfNeeded();
      await shot(page, 'desktop-1440-chart');
      await page.evaluate(() => window.scrollTo(0, 0));
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'desktop-1280');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await shot(page, 'tablet-768');

    for (const [width, height, label] of [[390, 844, '390'], [375, 667, '375']]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await shot(page, `mobile-${label}`);
    }

    if (phase === 'after') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: '明細' }).click();
      await expect(page.getByRole('table')).toContainText('一年級');
      await shot(page, 'table');
      await page.getByRole('button', { name: '系所分布' }).click();
      await expect(page.getByText('合成學系')).toBeVisible();
      await shot(page, 'department');
      await page.getByRole('tab', { name: '出席紀錄' }).click();
      await expect(page.getByText('匯入紀錄標示出席，來源尚待確認')).toBeVisible();
      await expect(page.locator('dt').filter({ hasText: '沒有匯入紀錄' })).toBeVisible();
      await expect(page.getByText('到考率', { exact: true })).toHaveCount(0);
      await shot(page, 'attendance');
      await page.getByRole('tab', { name: '四技能成績' }).click();
      await expect(page.getByText('不能還原更細的等級')).toBeVisible();
      await expect(page.getByText('24／50 人（48.0%）')).toBeVisible();
      await expect(page.getByText('B2 達標')).toHaveCount(0);
      await shot(page, 'skills');

      await page.setViewportSize({ width: 768, height: 1024 });
      await page.getByRole('tab', { name: '出席紀錄' }).click();
      await expect(page.getByRole('heading', { name: '聽力出席匯入' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await shot(page, 'tablet-768-attendance');

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('tab', { name: '四技能成績' }).click();
      await page.getByRole('button', { name: '口說' }).click();
      await expect(page.getByText('9／20 人（45.0%）')).toBeVisible();
      await page.getByRole('button', { name: '明細' }).click();
      await expect(page.getByRole('table')).toContainText('B2');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await shot(page, 'mobile-390-skills');
    }
    expect(leaked).toEqual([]);
  });

  test('empty, loading, error, and denied states stay honest', async ({ page }) => {
    test.skip(phase === 'before', '舊版只留對照截圖');
    const { state, leaked } = await installMocks(page);

    state.mode = 'loading';
    await page.goto(PAGE);
    await expect(page.getByRole('status')).toContainText('載入統計資料中');
    await shot(page, 'loading');
    state.mode = 'ready';
    state.release?.();
    await expect(page.getByText('120', { exact: true })).toBeVisible();

    state.mode = 'empty';
    await page.goto(PAGE);
    await expect(page.getByText('這個範圍沒有報名資料')).toBeVisible();
    await shot(page, 'empty');

    state.mode = 'error';
    await page.goto(`${PAGE}&reload=1`);
    await expect(page.getByRole('alert')).toContainText('合成統計失敗');
    await shot(page, 'error');

    await page.goto('/admin/english-test?tab=analytics&profile=none');
    await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
    await shot(page, 'denied');
    expect(leaked).toEqual([]);
  });
});
