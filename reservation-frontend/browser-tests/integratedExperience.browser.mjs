import { test, expect } from '@playwright/test';

const HUB = '/browser-tests/index.html?route=/admin/analytics';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

function bestepBody() {
  return {
    classInfo: { classId: 'SYN-CLASS', className: '合成班', teacherName: '合成教師', semester: '115-1' },
    statistics: {
      domesticStudentCount: 1,
      totalStudents: 1,
      registrationRate: 25,
      passedCount: 3,
      passRate: 150,
      avgScore: 0,
    },
    students: [{
      studentId: 'SYN-N1-H',
      studentName: '合成辛',
      department: '合成學系',
      personalRegistration: { status: 'success', examType: 'LRSW', examTypeLabel: '聽讀說寫', exemptionType: '無', regId: 9 },
      groupRegistration: null,
      attendance: { L: { attended: true }, R: { attended: false }, S: { attended: null }, W: {} },
      score: { totalScore: 0, listeningScore: 0, readingScore: null, speakingScore: '', writingScore: undefined, listeningLevel: 'B2', passed: false },
    }],
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
  };
}

async function installApis(page) {
  const leaked = [];
  page.on('request', (request) => {
    if (new URL(request.url()).port === '3000') leaked.push(request.url());
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local) {
      await route.abort();
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/analytics/overview') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          semester: '115-1',
          totalReservations: 48,
          totalEventCapacity: 40,
          bookingRate: 17.5,
          attendanceRate: 40,
          violationRate: 1,
        }),
      });
      return;
    }
    if (url.pathname.startsWith('/api/analytics/')) {
      const body = url.pathname.endsWith('reservation-capacity-breakdown')
        ? { semester: '115-1', items: [{ eventType: 'English Table', totalReservations: 48, totalEventCapacity: 40, bookingRate: 17.5 }], byEvent: [], summary: { synthetic: true } }
        : { activityTrend: [], attendanceTrend: [], rankings: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bestepBody()) });
      return;
    }
    if (url.pathname.endsWith('/meta')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { snapshots: [], warnings: [], tableCounts: { lj_student_events: 4 }, hasAnalyticData: true, recommendedSnapshotVersion: 'synthetic-snapshot', filterOptions: {} } }),
      });
      return;
    }
    if (url.pathname.endsWith('/resources')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            causalClaimAllowed: false,
            resourceEffectiveness: [{ resourceType: 'GE', participantCount: 2, growthSampleSize: 0, rawGrowthAverage: null, evidenceLevel: 'descriptive_low', causalClaimAllowed: false, mainSkills: ['reading'], interpretation: '描述性趨勢；不能作因果宣稱。' }],
            skillExposure: { byResource: [{ resourceType: 'GE', events: 4 }], causalClaimAllowed: false },
          },
        }),
      });
      return;
    }
    if (url.pathname.endsWith('/skills')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            growth: { bySkill: [], summary: { retestCount: 0 }, episodes: [], byStartingGse: [] },
            adjustedGrowth: { bySkill: [], causalClaimAllowed: false },
            growthEpisodes: { sampleEpisodes: [] },
          },
        }),
      });
      return;
    }
    await route.abort();
  });
  return leaked;
}

async function pageOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('operations flow opens the overview and the existing activity list', async ({ page }) => {
  const leaked = await installApis(page);
  await page.goto(`${HUB}&profile=admin`);
  await page.getByRole('link', { name: '活動營運總覽' }).click();
  await expect(page.getByTestId('ops-observation')).toContainText('預約列');
  await page.getByRole('link', { name: '開啟活動列表' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '活動列表' })).toBeVisible();
  expect(leaked).toEqual([]);
});

test('BESTEP flow opens the class page, a student, and returns to the hub', async ({ page }) => {
  await installApis(page);
  await page.goto(`${HUB}&profile=admin`);
  await page.getByRole('link', { name: '班級列表' }).click();
  await expect(page.getByRole('link', { name: '返回成效分析中心' })).toBeVisible();
  await page.getByRole('button', { name: '查看 BESTEP 分析' }).click();
  await expect(page.getByRole('heading', { name: '合成班' })).toBeVisible();
  await expect(page.getByTestId('bestep-reading')).toContainText('尚未核准為官方達標率');
  await page.getByRole('button', { name: '查看詳情' }).click();
  await expect(page.getByText('L 出席')).toBeVisible();
  await page.getByRole('button', { name: '關閉' }).click();
  await page.getByRole('link', { name: '返回成效分析中心' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
});

test('learning flow opens resources, skills, and returns without a shared filter', async ({ page }) => {
  await installApis(page);
  await page.goto(`${HUB}&profile=admin`);
  const resources = page.getByRole('link', { name: '資源覆蓋' });
  await expect(resources).toHaveAttribute('href', '/admin/learning-analytics/resources');
  await resources.click();
  await expect(page.getByTestId('learning-reading')).toContainText('不代表資源造成能力提升');
  await page.getByRole('link', { name: '開啟技能成長' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '技能成長' })).toBeVisible();
  await expect(page.getByText('不代表課程造成進步').first()).toBeVisible();
  const back = page.getByRole('link', { name: '返回成效分析中心' });
  await expect(back).toHaveAttribute('href', '/admin/analytics');
  await back.click();
  await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
});

test('hub shows only the domains each profile can open', async ({ page }) => {
  const cases = [
    ['admin', ['活動營運總覽', '班級列表', '資源覆蓋'], []],
    ['executive', ['活動營運總覽', '班級列表', '資源覆蓋'], []],
    ['classOnly', ['班級列表'], ['活動營運總覽', '資源覆蓋']],
    ['learning', ['資源覆蓋'], ['活動營運總覽', '班級列表']],
    // 一般教師的活動分析權限可進 Hub，但活動營運總覽只開放 admin / executive。
    ['operations', [], ['活動營運總覽', '班級列表', '資源覆蓋']],
    ['none', [], ['活動營運總覽', '班級列表', '資源覆蓋']],
    ['anonymous', [], ['活動營運總覽', '班級列表', '資源覆蓋']],
  ];
  for (const [profile, visible, hidden] of cases) {
    await page.goto(`${HUB}&profile=${profile}`);
    await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
    for (const name of visible) {
      await expect(page.getByRole('link', { name })).toBeVisible();
    }
    for (const name of hidden) {
      await expect(page.getByRole('link', { name })).toHaveCount(0);
    }
    if (profile === 'operations') {
      await expect(page.getByText('活動營運總覽：沒有權限')).toBeVisible();
    }
    await expect(page.getByText('SYN-N1-H')).toHaveCount(0);
  }
});

test('hub stays inside five viewports and the primary links can take focus', async ({ page }) => {
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${HUB}&profile=admin`);
    const link = page.getByRole('link', { name: '活動營運總覽' });
    await link.focus();
    await expect(link).toBeFocused();
    expect(await pageOverflow(page), viewport.name).toBeLessThanOrEqual(1);
  }
});
