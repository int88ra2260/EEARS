import { test, expect } from '@playwright/test';

const phase = process.env.UX_R2_PHASE === 'before' ? 'before' : 'after';
const OUT = 'review-output/ux-r2';
const EXPLORE = '/admin/learning-analytics/explore?profile=learning';

const meta = {
  success: true,
  data: {
    snapshots: [{ snapshotVersion: 'snap-a', label: '合成 A', scope: 'global' }],
    warnings: [],
    tableCounts: {},
    recommendedSnapshotVersion: 'snap-a',
    hasAnalyticData: true,
    filterOptions: {},
  },
};

function explorerItems() {
  return [
    {
      studentId: 'S100',
      studentName: '合成生',
      department: '合成學系',
      cohort: '114',
      placementLabel: '中級',
      hasPreTest: true,
      hasPostTest: false,
      totalActivityHours: 0,
      totalCourseHours: null,
    },
    {
      studentId: 'S200',
      studentName: null,
      department: '合成學系',
      cohort: '114',
      placementLabel: null,
      hasPreTest: false,
      hasPostTest: false,
      totalActivityHours: null,
      totalCourseHours: null,
    },
  ];
}

const journey = {
  success: true,
  data: {
    student: { studentId: 'S100', department: '合成學系', cohort: '114', name: '合成生' },
    timeline: [
      { eventId: 'exam-zero', lane: 'exam', eventDate: '2026-03-01', title: '聽力', rawScore: 0, cefrLevel: 'B1', hours: null },
      { eventId: 'exam-missing', lane: 'exam', eventDate: '2026-06-01', title: '閱讀', rawScore: null, cefrLevel: null, hours: null },
      { eventId: 'course-1', lane: 'course', eventDate: '2026-04-01', title: '通識英文', hours: 18, rawScore: null },
    ],
    meta: { snapshotVersion: 'snap-a', warnings: [] },
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
    const payload = (data) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
    if (url.pathname.endsWith('/meta')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meta) });
      return;
    }
    if (url.pathname.endsWith('/student-explorer')) {
      const items = explorerItems();
      await payload({
        snapshotVersion: 'snap-a',
        items,
        pagination: { total: items.length },
        summary: { matched: items.length, withValidExam: 1, averageActivityHours: 0 },
        options: { departments: ['合成學系'], cohorts: ['114'], exportRowLimit: 5000 },
      });
      return;
    }
    if (url.pathname.endsWith('/b1-plus')) {
      await payload({
        definition: { rule: '尚未達 B2，且目前最佳 GSE 51–58。' },
        summary: { matched: 1 },
        pagination: { total: 1 },
        items: [],
        options: { departments: [], colleges: [], cohorts: [] },
      });
      return;
    }
    if (url.pathname.includes('/journey')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(journey) });
      return;
    }
    await payload({});
  });
  return leaked;
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${phase}-${name}.png` });
}

async function openExplorer(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto(EXPLORE);
  await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'S100' })).toBeVisible();
}

test.describe('student explorer visual review', () => {
  test('captures the explorer workbench', async ({ page }) => {
    test.setTimeout(120000);
    const leaked = await installMocks(page);

    await openExplorer(page, 1440, 900);
    if (phase === 'after') {
      await expect(page.getByRole('navigation', { name: '學習成效分析' })).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 2, name: '學生結果' })).toBeVisible();
    }
    await shot(page, 'desktop-1440');

    await page.setViewportSize({ width: 1280, height: 800 });
    await shot(page, 'desktop-1280');

    await page.getByRole('button', { name: 'S100' }).click();
    const drawer = page.getByRole('dialog', { name: '學生明細' });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText('0');
    await expect(drawer).toContainText('沒有原始分');
    await shot(page, 'desktop-drawer');
    await drawer.getByRole('button', { name: '學習時間軸' }).click();
    await expect(drawer).toContainText('通識英文');
    await shot(page, 'desktop-drawer-timeline');
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);
    await shot(page, 'tablet-768');

    for (const [width, height, label] of [[390, 844, '390'], [375, 667, '375']]) {
      await page.setViewportSize({ width, height });
      await shot(page, `mobile-${label}-first`);
      if (phase === 'after') {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      }
      if (phase === 'after') {
        await page.getByRole('button', { name: '篩選條件' }).click();
        await expect(page.getByRole('combobox', { name: '系所' })).toBeVisible();
        await shot(page, `mobile-${label}-filters`);
        await page.getByRole('button', { name: '回到結果' }).click();
      }
      const student = page.getByRole('button', { name: 'S100' });
      await student.scrollIntoViewIfNeeded();
      await shot(page, `mobile-${label}-results`);
      if (phase === 'before') await student.click({ position: { x: 8, y: 8 } });
      else await student.click();
      await expect(drawer).toBeVisible();
      await shot(page, `mobile-${label}-drawer`);
      if (phase === 'after') {
        const drawerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(drawerOverflow).toBeLessThanOrEqual(1);
      }
      await drawer.getByRole('button', { name: '學習時間軸' }).click();
      await shot(page, `mobile-${label}-drawer-timeline`);
      await drawer.getByRole('button', { name: '關閉', exact: true }).click();
      await expect(drawer).toHaveCount(0);
    }

    if (phase === 'after') {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => {
        sessionStorage.setItem('eears.la.workingSet.v1', JSON.stringify({
          label: '課Ａ學生',
          studentIds: ['S100'],
          total: 1,
          truncated: false,
          context: { snapshotVersion: 'snap-a', semester: '114-2' },
        }));
      });
      await page.goto(EXPLORE);
      await expect(page.getByTestId('la-working-set')).toContainText('目前正在分析特定學生群體');
      await expect(page.getByTestId('la-working-set')).toContainText('固定名單');
      await shot(page, 'working-set-applied');

      await page.evaluate(() => {
        const raw = JSON.parse(sessionStorage.getItem('eears.la.workingSet.v1'));
        raw.context.snapshotVersion = 'snap-other';
        sessionStorage.setItem('eears.la.workingSet.v1', JSON.stringify(raw));
      });
      await page.goto('/admin/learning-analytics/b1-plus?profile=learning');
      await expect(page.getByRole('heading', { level: 1, name: '接近 B2' })).toBeVisible();
      await expect(page.getByTestId('la-working-set')).toContainText('尚未套用這份固定名單');
      await shot(page, 'working-set-paused');
    }

    expect(leaked).toEqual([]);
  });

  test('applies filters and keeps finder history', async ({ page }) => {
    test.skip(phase === 'before', 'interaction checks belong to the redesigned page');
    await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(EXPLORE);
    await page.getByRole('button', { name: '篩選條件' }).click();
    await expect(page.getByRole('combobox', { name: '系所' })).toHaveCount(0);
    await page.getByRole('button', { name: '篩選條件' }).click();
    await page.getByLabel('系所').selectOption('合成學系');
    await page.getByRole('button', { name: '搜尋' }).click();
    await expect(page.getByRole('group', { name: '目前篩選' })).toContainText('合成學系');
    await page.getByRole('button', { name: '重設' }).click();
    await expect(page.getByRole('group', { name: '目前篩選' })).toContainText('目前是全部學生');
    await page.getByRole('navigation', { name: '找學生' }).getByRole('link', { name: '接近 B2' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '接近 B2' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1, name: '接近 B2' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '學習成效分析' })).toHaveCount(0);
    const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
    await sidebar.getByRole('button', { name: '上呈' }).click();
    await expect(sidebar.getByRole('link', { name: '學習成效概況' })).toBeVisible();
  });
});
