import { test, expect } from '@playwright/test';

const EXPLORE = '/admin/learning-analytics/explore?profile=learning';

const meta = {
  success: true,
  data: {
    snapshots: [
      { snapshotVersion: 'snap-a', label: '合成 A', scope: 'global' },
      { snapshotVersion: 'snap-b', label: '合成 B', scope: 'global' },
    ],
    warnings: [],
    tableCounts: {},
    recommendedSnapshotVersion: 'snap-a',
    hasAnalyticData: true,
    filterOptions: {},
  },
};

function explorerItems() {
  const rows = [
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
  for (let index = 0; index < 24; index += 1) {
    rows.push({
      studentId: `S3${String(index).padStart(2, '0')}`,
      studentName: null,
      department: '合成學系',
      cohort: '114',
      placementLabel: null,
      hasPreTest: false,
      hasPostTest: false,
      totalActivityHours: null,
      totalCourseHours: null,
    });
  }
  return rows;
}

const journey = {
  success: true,
  data: {
    student: { studentId: 'S100', department: '合成學系', cohort: '114', name: '合成生' },
    timeline: [
      {
        eventId: 'exam-zero',
        lane: 'exam',
        eventDate: '2026-03-01',
        title: '聽力',
        rawScore: 0,
        cefrLevel: 'B1',
        hours: null,
      },
      {
        eventId: 'exam-missing',
        lane: 'exam',
        eventDate: '2026-06-01',
        title: '閱讀',
        rawScore: null,
        cefrLevel: null,
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
    meta: { snapshotVersion: 'snap-a', warnings: [] },
  },
};

async function installMocks(page) {
  const leaked = [];
  const calls = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.port === '3000') leaked.push(request.url());
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.port === '3000') {
      await route.abort();
      return;
    }
    const body = request.method() === 'POST' ? request.postData() || '' : '';
    calls.push({ path: url.pathname, method: request.method(), body });
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
      const ids = body.includes('S100') ? ['S100'] : null;
      const items = explorerItems().filter((row) => !ids || ids.includes(row.studentId));
      await payload({
        snapshotVersion: 'snap-a',
        items,
        pagination: { total: items.length },
        summary: { matched: items.length, withValidExam: 1, averageActivityHours: 0 },
        options: { departments: ['合成學系'], exportRowLimit: 5000 },
      });
      return;
    }
    if (url.pathname.endsWith('/b1-plus')) {
      await payload({
        definition: { rule: '尚未達 B2，且目前最佳 GSE 51–58。' },
        summary: { matched: 1, withPretest: 1, withCourse: 0, withActivity: 1, gseMin: 51, gseMax: 58 },
        options: { departments: ['合成學系'], colleges: [], cohorts: ['114'] },
        pagination: { total: 1 },
        items: [{
          studentId: 'S100',
          studentName: '合成生',
          department: '合成學系',
          cohort: '114',
          bestGse: 54,
          currentLevel: 'B1',
          pretest: { listening: 'B1' },
          pretestGse: { listening: 54 },
          hasCourse: false,
          courseInProgress: false,
          activityHours: 0,
          situation: 'neither',
        }],
        handoff: { studentIds: ['S100'], total: 1, truncated: false },
      });
      return;
    }
    if (url.pathname.endsWith('/tracking-cohorts')) {
      await payload({
        items: [{
          id: 'c1',
          name: '合成追蹤',
          memberCount: 1,
          filters: {},
          createdAt: '2026-03-01T00:00:00.000Z',
          truncated: false,
        }],
      });
      return;
    }
    if (url.pathname.includes('/tracking-cohorts/')) {
      await payload({
        cohort: {
          name: '合成追蹤',
          filters: {},
          createdAt: '2026-03-01T00:00:00.000Z',
          memberCount: 1,
        },
        summary: { memberCount: 1, gainedPostTest: 0, averageActivityDelta: 0, averageCourseDelta: null },
        pagination: { total: 1 },
        items: [{
          studentId: 'S100',
          studentName: '合成生',
          department: '合成學系',
          enrollmentCohort: '114',
          placementLabel: '中級',
          baseline: { examLabel: '前測', activityHours: 0, courseHours: null },
          current: { examLabel: '目前', activityHours: 0, courseHours: null },
          delta: { activityHours: 0, courseHours: null },
          missingFromSnapshot: false,
        }],
      });
      return;
    }
    if (url.pathname.includes('/journey')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(journey) });
      return;
    }
    if (url.pathname.endsWith('/skills')) {
      await payload({
        growth: { bySkill: [], summary: { retestCount: 0, excludedPlaceholderScoreRows: 0 }, episodes: [], byStartingGse: [] },
        adjustedGrowth: { bySkill: [], causalClaimAllowed: false },
        growthEpisodes: { sampleEpisodes: [], retestStudentCount: 0 },
      });
      return;
    }
    if (url.pathname.includes('/kpi/policies')) {
      await payload([]);
      return;
    }
    await payload({});
  });
  return { leaked, calls };
}

async function seedFixedList(page) {
  await page.evaluate(() => {
    sessionStorage.setItem('eears.la.workingSet.v1', JSON.stringify({
      label: '課Ａ學生',
      studentIds: ['S100'],
      total: 1,
      truncated: false,
      context: { snapshotVersion: 'snap-a', semester: '114-2' },
    }));
  });
  await page.reload();
}

test.describe('find students on the admin shell', () => {
  test('keeps a fixed list distinct from each finder, including pause and return', async ({ page }) => {
    test.setTimeout(90000);
    const { leaked, calls } = await installMocks(page);
    await page.goto(EXPLORE);
    await seedFixedList(page);
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '找學生' })).toContainText('條件探索');
    await expect(page.getByRole('navigation', { name: '找學生' })).toContainText('這份結果不是接近 B2');
    const banner = page.getByTestId('la-working-set');
    await expect(banner).toContainText('目前正在分析特定學生群體');
    await expect(banner).toContainText('課Ａ學生（1 人）');
    await expect(banner).toContainText('固定名單');
    await expect(banner).toContainText('沒有依這頁條件重篩');

    const row = page.getByRole('row').filter({ hasText: 'S100' });
    await expect(row).toContainText('0 hr');
    await expect(row).toContainText('—');
    await expect(row).toContainText('沒有後測');
    await page.screenshot({ path: 'test-results/find-students-after-desktop.png' });

    await row.getByRole('button', { name: 'S100' }).click();
    const drawer = page.getByRole('dialog', { name: '學生明細' });
    await expect(drawer).toContainText('0');
    await expect(drawer).toContainText('沒有原始分');
    await expect(drawer).toContainText('待補');
    await drawer.getByRole('button', { name: '學習時間軸' }).click();
    await expect(drawer).toContainText('通識英文');
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();

    await page.getByRole('navigation', { name: '找學生' }).getByRole('link', { name: '接近 B2' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '接近 B2' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '找學生' })).toContainText('GSE 在 51–58');
    await expect(page.getByRole('navigation', { name: '找學生' })).not.toContainText('這份結果不是接近 B2');

    await page.getByRole('navigation', { name: '找學生' }).getByRole('link', { name: '追蹤名單' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '追蹤名單' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '找學生' })).toContainText('不套用「這批人」');
    await expect(page.getByTestId('la-working-set')).toHaveCount(0);

    const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
    await sidebar.getByRole('button', { name: '比較與資料' }).click();
    await sidebar.getByRole('link', { name: '群體與技能比較' }).click();
    await expect(banner).toContainText('固定名單');
    await page.getByRole('combobox', { name: '資料版本' }).selectOption('snap-b');
    await page.getByRole('button', { name: '套用篩選' }).click();
    await expect(banner).toContainText('尚未套用這份固定名單');
    await page.getByRole('button', { name: '沿用這份固定名單' }).click();
    await expect(banner).toContainText('沒有依這頁條件重篩');
    await expect(banner).not.toContainText('重新篩選');

    await page.goto('/admin/learning-analytics/kpi-report?profile=learning');
    await page.getByRole('combobox', { name: '名冊學期' }).selectOption('__custom');
    await page.getByRole('textbox', { name: '其他學期代碼' }).fill('115-9');
    await expect(banner).toContainText('尚未套用這份固定名單');
    await page.getByRole('button', { name: '沿用這份固定名單' }).click();
    await expect(banner).toContainText('固定名單');
    await expect(banner).not.toContainText('重新篩選');
    await page.getByRole('button', { name: '清除群體篩選' }).click();
    await expect(page.getByTestId('la-working-set')).toHaveCount(0);

    await page.goto(EXPLORE);
    await expect(page.getByTestId('la-working-set')).toHaveCount(0);
    await page.getByRole('row').filter({ hasText: 'S323' }).scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => {
      const chain = [];
      let node = document.querySelector('.la-explorer');
      while (node) {
        chain.push({
          className: String(node.className || node.tagName).slice(0, 48),
          top: node.scrollTop,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        });
        node = node.parentElement;
      }
      return { win: window.scrollY, chain };
    });
    expect(position.win, JSON.stringify(position)).toBeGreaterThan(80);
    await page.getByRole('row').filter({ hasText: 'S323' }).getByRole('link', { name: '完整軌跡' }).click();
    await expect(page.getByRole('button', { name: '返回名單' })).toBeVisible();
    await page.getByRole('button', { name: '返回名單' }).click();
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(position.win - 24);

    const explorerCalls = calls.filter((call) => call.path.endsWith('/student-explorer'));
    expect(explorerCalls.some((call) => call.method === 'POST' && call.body.includes('S100'))).toBe(true);
    expect(explorerCalls.at(-1).method).not.toBe('POST');
    expect(leaked).toEqual([]);
  });

  test('old urls keep one sidebar entry through reload and back', async ({ page }) => {
    await installMocks(page);
    const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
    const pages = [
      [EXPLORE, '學生探索'],
      ['/admin/learning-analytics/b1-plus?profile=learning', '接近 B2'],
      ['/admin/learning-analytics/tracking-cohorts?profile=learning', '追蹤名單'],
      ['/admin/learning-analytics/students?profile=learning', '個人軌跡'],
    ];
    for (const [url, heading] of pages) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: '找學生' })).toHaveClass(/admin-sidebar__link--active/);
      await expect(sidebar.getByRole('link', { name: '接近 B2' })).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: '學生探索' })).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: '追蹤名單' })).toHaveCount(0);
      await expect(sidebar.getByRole('link', { name: '個人軌跡' })).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(sidebar.getByRole('link', { name: '找學生' })).toHaveClass(/admin-sidebar__link--active/);
    }
    await page.goto('/admin/learning-analytics/students/S100?profile=learning');
    await expect(page.getByRole('navigation', { name: '找學生' })).toContainText('個人完整頁');
    await expect(sidebar.getByRole('link', { name: '找學生' })).toHaveClass(/admin-sidebar__link--active/);
    await page.goto(EXPLORE);
    await page.getByRole('navigation', { name: '找學生' }).getByRole('link', { name: '接近 B2' }).click();
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
    const entry = sidebar.getByRole('link', { name: '找學生' });
    await expect(entry).toHaveClass(/admin-sidebar__link--active/);
    await entry.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/sidebar-after-desktop.png' });
  });

  test('the same finder fits a phone width', async ({ page }) => {
    await installMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(EXPLORE);
    await expect(page.getByRole('navigation', { name: '找學生' })).toBeVisible();
    await page.getByRole('button', { name: '選單' }).click();
    const sidebar = page.getByRole('complementary', { name: '後台主導覽' });
    await expect(sidebar.getByRole('link', { name: '找學生' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: '接近 B2' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: '個人軌跡' })).toHaveCount(0);
    await sidebar.getByRole('link', { name: '找學生' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/sidebar-after-mobile.png' });
    await sidebar.getByRole('link', { name: '找學生' }).click();
    await page.getByRole('button', { name: 'S100' }).click({ position: { x: 8, y: 8 } });
    const drawer = page.getByRole('dialog', { name: '學生明細' });
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/find-students-after-mobile.png' });
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toBeVisible();
  });

  test('a profile without learning analytics permission cannot open the finder', async ({ page }) => {
    await installMocks(page);
    await page.goto('/admin/learning-analytics/explore?profile=none');
    await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: '學生探索' })).toHaveCount(0);
    await expect(page.getByRole('complementary', { name: '後台主導覽' }).getByRole('link', { name: '找學生' })).toHaveCount(0);
  });
});
