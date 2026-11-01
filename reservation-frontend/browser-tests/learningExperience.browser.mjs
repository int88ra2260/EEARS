import { test, expect } from '@playwright/test';

const HUB = '/browser-tests/index.html?route=/admin/analytics&profile=admin';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

const meta = {
  success: true,
  data: {
    snapshots: [],
    warnings: [],
    tableCounts: { lj_student_events: 4 },
    recommendedSnapshotVersion: 'synthetic-snapshot',
    hasAnalyticData: true,
    filterOptions: {},
  },
};

function resourcesBody(which) {
  const row = which === 'second'
    ? {
      resourceType: 'EAP',
      participantCount: null,
      growthSampleSize: null,
      rawGrowthAverage: null,
      evidenceLevel: 'descriptive_low',
      causalClaimAllowed: false,
      mainSkills: [],
      interpretation: '描述性趨勢；不能作因果宣稱。',
    }
    : {
      resourceType: 'GE',
      participantCount: 0,
      growthSampleSize: 0,
      rawGrowthAverage: 0,
      evidenceLevel: 'descriptive_medium',
      causalClaimAllowed: false,
      mainSkills: ['reading'],
      interpretation: '描述性趨勢；不能作因果宣稱。',
    };
  return {
    success: true,
    data: {
      causalClaimAllowed: false,
      resourceEffectiveness: which === 'empty' ? [] : [row],
      skillExposure: {
        causalClaimAllowed: false,
        byResource: which === 'empty' ? [] : [{ resourceType: row.resourceType, events: which === 'second' ? 0 : 4 }],
      },
    },
  };
}

async function mockLearning(page, mode = 'ok') {
  const leaked = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.port === '3000') leaked.push(request.url());
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/admin/learning-analytics/'))) {
      await route.abort();
      return;
    }
    await route.fallback();
  });
  await page.route('**/api/admin/learning-analytics/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/meta')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meta) });
      return;
    }
    if (url.pathname.endsWith('/resources')) {
      if (mode === 'error') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'SQL exploded' }) });
        return;
      }
      const semester = url.searchParams.get('semester') || '';
      const which = mode === 'empty' ? 'empty' : (semester === '114-1' ? 'second' : 'first');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resourcesBody(which)) });
      return;
    }
    if (url.pathname.endsWith('/skills')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            growth: { bySkill: [], summary: { retestCount: 0, excludedPlaceholderScoreRows: 0 }, episodes: [], byStartingGse: [] },
            adjustedGrowth: { bySkill: [], causalClaimAllowed: false },
            growthEpisodes: { sampleEpisodes: [], retestStudentCount: 0 },
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

test('hub opens resource exposure, evidence limits, and the existing skills page', async ({ page }) => {
  const leaked = await mockLearning(page);
  await page.goto(HUB);
  await page.getByRole('link', { name: '資源覆蓋' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '資源覆蓋' })).toBeVisible();
  await expect(page.getByTestId('learning-reading')).toContainText('不代表資源造成能力提升');
  await expect(page.getByRole('cell', { name: '通識英文' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '0', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: '怎麼讀這頁' }).click();
  await expect(page.getByText('不會把匿名軌跡配成')).toBeVisible();
  await expect(page.getByText('不會改寫成未觀察')).toBeVisible();
  await expect(page.getByText('這份資源回應沒有排除原因明細')).toBeVisible();
  await page.getByLabel('學期').selectOption('114-1');
  await page.getByRole('button', { name: '套用篩選' }).click();
  await expect(page.getByRole('cell', { name: 'EAP 寫作／學術英文' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '通識英文' })).toHaveCount(0);
  await page.getByRole('link', { name: '開啟技能成長' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '技能成長' })).toBeVisible();
  await expect(page.getByText('不代表課程造成進步').first()).toBeVisible();
  expect(leaked).toEqual([]);
});

test('empty and failed resource responses do not invent participation', async ({ page }) => {
  await mockLearning(page, 'empty');
  await page.goto('/browser-tests/index.html?route=/admin/learning-analytics/resources&profile=learning');
  await expect(page.getByText('尚無可用紀錄。不能推論沒有學習。')).toBeVisible();
  await expect(page.locator('tbody').getByText('0')).toHaveCount(0);

  await mockLearning(page, 'error');
  await page.goto('/browser-tests/index.html?route=/admin/learning-analytics/resources&profile=learning');
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText('通識英文')).toHaveCount(0);
  await expect(page.getByText('SQL exploded')).toHaveCount(0);
});

test('resource reading stays inside the viewport and the disclosure is keyboard reachable', async ({ page }) => {
  await mockLearning(page);
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/browser-tests/index.html?route=/admin/learning-analytics/resources&profile=admin');
    await expect(page.getByRole('heading', { level: 1, name: '資源覆蓋' })).toBeVisible();
    const fold = page.getByRole('button', { name: '怎麼讀這頁' });
    await fold.focus();
    await expect(fold).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('沿用 API 的 evidenceLevel')).toBeVisible();
    expect(await pageOverflow(page), viewport.name).toBeLessThanOrEqual(1);
  }
});
