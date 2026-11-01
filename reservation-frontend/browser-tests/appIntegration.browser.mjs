import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

function appUrl(path, profile = 'admin') {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}profile=${profile}`;
}

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
      score: {
        totalScore: 0,
        listeningScore: 0,
        readingScore: null,
        speakingScore: '',
        writingScore: undefined,
        listeningLevel: 'B2',
        passed: false,
      },
    }],
    pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
  };
}

async function installApis(page) {
  const leaked = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.port === '3000') leaked.push(request.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) leaked.push(request.url());
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
    const path = url.pathname;

    if (path === '/api/login/info') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { ssoEnabled: false } }),
      });
      return;
    }

    if (path === '/api/analytics/overview') {
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

    if (path.startsWith('/api/analytics/')) {
      const body = path.includes('reservation-capacity-breakdown')
        ? {
          semester: '115-1',
          items: [{ eventType: 'English Table', totalReservations: 48, totalEventCapacity: 40, bookingRate: 17.5 }],
          byEventType: [{ eventType: 'English Table', totalReservations: 48, totalEventCapacity: 40, bookingRate: 17.5 }],
          byEvent: [],
          summary: { synthetic: true },
        }
        : { activityTrend: [], attendanceTrend: [], rankings: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }

    if (path === '/api/admin/classes/overview') {
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

    if (path === '/api/admin/classes/SYN-CLASS/bestep-overview') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(bestepBody()),
      });
      return;
    }

    if (path === '/api/reports/summary') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          eventId: 'SYN-EVT-1',
          name: '合成活動',
          eventType: 'English Table',
          date: '2026-11-01',
          startTime: '10:00',
          endTime: '11:00',
          location: '合成教室',
          notes: '',
          reservedCount: 2,
          availableSpots: 8,
          hiddenFromStudents: false,
        }]),
      });
      return;
    }

    if (path === '/api/event-types') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ code: 'ET', name: 'English Table', isActive: true }] }),
      });
      return;
    }

    if (path.endsWith('/meta')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            snapshots: [{ version: 'synthetic-snapshot', label: '合成快照' }],
            warnings: [],
            tableCounts: { lj_student_events: 4 },
            hasAnalyticData: true,
            recommendedSnapshotVersion: 'synthetic-snapshot',
            filterOptions: { semesters: [{ value: '115-1', label: '115-1' }, { value: '114-2', label: '114-2' }] },
          },
        }),
      });
      return;
    }

    if (path.endsWith('/resources')) {
      const semester = url.searchParams.get('semester');
      const rows = semester === '114-2'
        ? []
        : [{
          resourceType: 'GE',
          participantCount: 2,
          growthSampleSize: 0,
          rawGrowthAverage: null,
          evidenceLevel: 'descriptive_low',
          causalClaimAllowed: false,
          mainSkills: ['reading'],
          interpretation: '描述性趨勢；不能作因果宣稱。',
        }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            causalClaimAllowed: false,
            resourceEffectiveness: rows,
            skillExposure: {
              byResource: rows.length ? [{ resourceType: 'GE', events: 4 }] : [],
              causalClaimAllowed: false,
            },
          },
        }),
      });
      return;
    }

    if (path.endsWith('/skills')) {
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

    if (path.startsWith('/api/admin/et-grouping/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0 }),
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

test('operations flow uses AdminLayout, real activity list, URL history, and return', async ({ page }) => {
  const leaked = await installApis(page);
  await page.goto(appUrl('/admin/analytics', 'admin'));
  await expect(page).toHaveURL(/\/admin\/analytics/);
  await expect(page.getByRole('heading', { level: 1, name: '成效分析中心' })).toBeVisible();
  await expect(page.locator('#admin-sidebar-nav')).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: '活動營運總覽' }).click();
  await expect(page).toHaveURL(/\/admin\/analytics\/overview/);
  await expect(page.getByTestId('ops-observation')).toContainText('預約列');
  await page.getByRole('link', { name: '開啟活動列表' }).click();
  await expect(page).toHaveURL(/\/admin\/operations/);
  const clearDate = page.getByRole('button', { name: '不限日期' });
  if (await clearDate.count()) {
    await clearDate.click();
  }
  await expect(page.getByText('合成活動')).toBeVisible();
  await expect(page.getByLabel('活動概況')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/analytics\/overview/);
  await page.getByRole('link', { name: '返回成效分析中心' }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  expect(leaked).toEqual([]);
});

test('BESTEP flow opens the real class pages under AdminLayout', async ({ page }) => {
  const leaked = await installApis(page);
  await page.goto(appUrl('/admin/analytics', 'admin'));
  await page.getByRole('main').getByRole('link', { name: '班級列表' }).click();
  await expect(page).toHaveURL(/\/admin\/classes/);
  await expect(page.getByRole('link', { name: '返回成效分析中心' })).toBeVisible();
  await page.getByRole('button', { name: '查看 BESTEP 分析' }).click();
  await expect(page).toHaveURL(/\/admin\/classes\/SYN-CLASS\/bestep/);
  await expect(page.getByRole('heading', { name: '合成班' })).toBeVisible();
  await expect(page.getByTestId('bestep-reading')).toContainText('尚未核准為官方達標率');
  await expect(page.getByTestId('bestep-reading')).toContainText('150%');
  await page.getByRole('button', { name: '查看詳情' }).click();
  await expect(page.getByText('L 出席')).toBeVisible();
  await expect(page.getByText('未確認').first()).toBeVisible();
  await page.getByRole('button', { name: '關閉' }).click();
  await page.getByRole('button', { name: '返回班級列表' }).click();
  await expect(page).toHaveURL(/\/admin\/classes/);
  await page.getByRole('link', { name: '返回成效分析中心' }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  expect(leaked).toEqual([]);
});

test('learning flow keeps resource and event counts separate under AdminLayout', async ({ page }) => {
  const leaked = await installApis(page);
  await page.goto(appUrl('/admin/analytics', 'admin'));
  await page.getByRole('main').getByRole('link', { name: '資源覆蓋' }).click();
  await expect(page).toHaveURL(/\/admin\/learning-analytics\/resources/);
  await expect(page.getByRole('heading', { level: 1, name: '資源覆蓋' })).toBeVisible();
  await expect(page.getByTestId('learning-reading')).toContainText('不代表資源造成能力提升');
  await page.getByRole('button', { name: '怎麼讀這頁' }).click();
  await expect(page.getByText(/不重複學生數/).first()).toBeVisible();
  await page.getByRole('link', { name: '開啟技能成長' }).click();
  await expect(page).toHaveURL(/\/admin\/learning-analytics\/skills/);
  await expect(page.getByRole('heading', { level: 1, name: '技能成長' })).toBeVisible();
  await expect(page.getByText('不代表課程造成進步').first()).toBeVisible();
  await page.getByRole('link', { name: '返回成效分析中心' }).click();
  await expect(page).toHaveURL(/\/admin\/analytics$/);
  expect(leaked).toEqual([]);
});

test('frontend guards block unauthenticated and denied deep links', async ({ page }) => {
  const leaked = await installApis(page);

  await page.goto(appUrl('/admin/analytics', 'anonymous'));
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByRole('heading', { name: '後台登入' })).toBeVisible();

  await page.goto(appUrl('/admin/analytics/overview', 'classOnly'));
  await expect(page.getByText('無權限檢視此頁面')).toBeVisible();
  await expect(page.getByTestId('ops-observation')).toHaveCount(0);

  await page.goto(appUrl('/admin/classes/SYN-CLASS/bestep', 'learning'));
  await expect(page.getByText('無權限檢視此頁面')).toBeVisible();
  await expect(page.getByText('SYN-N1-H')).toHaveCount(0);

  await page.goto(appUrl('/admin/learning-analytics/resources', 'classOnly'));
  await expect(page.getByText('無權限檢視此頁面')).toBeVisible();

  await page.goto(appUrl('/admin/analytics', 'operations'));
  await expect(page.getByTestId('analytics-hub-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: '活動營運總覽' })).toHaveCount(0);

  expect(leaked).toEqual([]);
});

test('browser history and refresh keep AdminLayout on deep links', async ({ page }) => {
  const leaked = await installApis(page);
  await page.goto(appUrl('/admin/analytics', 'admin'));
  await page.getByRole('link', { name: '班級列表' }).click();
  await page.getByRole('button', { name: '查看 BESTEP 分析' }).click();
  await expect(page).toHaveURL(/\/admin\/classes\/SYN-CLASS\/bestep/);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/classes/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/classes\/SYN-CLASS\/bestep/);
  await page.reload();
  await expect(page.getByRole('heading', { name: '合成班' })).toBeVisible();
  await expect(page.locator('#admin-sidebar-nav')).toBeVisible();
  expect(leaked).toEqual([]);
});

test('AdminLayout hub stays usable across five viewports', async ({ page }) => {
  const leaked = await installApis(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(appUrl('/admin/analytics', 'admin'));
    if (viewport.width <= 991) {
      await page.getByRole('button', { name: '選單' }).click();
    }
    await expect(page.locator('#admin-sidebar-nav')).toBeVisible();
    const link = page.getByRole('main').getByRole('link', { name: '活動營運總覽' });
    await link.focus();
    await expect(link).toBeFocused();
    expect(await pageOverflow(page), viewport.name).toBeLessThanOrEqual(1);
  }
  expect(leaked).toEqual([]);
});
