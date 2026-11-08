import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('review-output/comparison-ux-r5');
const viewports = [
  [1440, 900],
  [1280, 800],
  [768, 1024],
  [390, 844],
  [375, 667],
];

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, data, error: status >= 400 ? '載入失敗' : undefined }),
  };
}

const meta = {
  hasAnalyticData: true,
  recommendedSnapshotVersion: 'synth-1',
  snapshotVersionCount: 2,
  snapshots: [
    { snapshotVersion: 'synth-1', label: '合成快照', scope: 'global' },
    { snapshotVersion: 'synth-2', label: '合成快照 2', scope: 'global' },
  ],
  filterOptions: {
    cohorts: [{ value: '113', label: '113' }],
    colleges: [{ value: '文學院', label: '文學院' }],
    departments: [{ value: '外文系', label: '外文系' }],
    instruments: ['BESTEP'],
    skills: ['listening', 'reading', 'speaking', 'writing'],
  },
};

function cohortRow(groupKey, episodes, actual) {
  return {
    groupKey,
    students: groupKey === '外文系' ? 12 : 8,
    multiExamCount: episodes > 0 ? 6 : 0,
    b2plusCount: episodes > 0 ? 4 : 0,
    b2plusRate: episodes > 0 ? 0.5 : 0,
    retestRate: 0.25,
    avgResourceHours: 4,
    growthEpisodeCount: episodes,
    avgActualGseGrowth: actual,
    avgAdjustedGseGrowth: episodes > 0 ? 1.2 : null,
  };
}

function cohortsPayload(groupBy = 'department') {
  const rows = groupBy === 'college'
    ? [cohortRow('文學院', 6, 1.5)]
    : [cohortRow('外文系', 0, 0), cohortRow('電機系', 4, 0)];
  return {
    snapshotVersion: 'synth-1',
    groupBy,
    totalStudents: rows.reduce((sum, row) => sum + row.students, 0),
    totalGrowthEpisodes: rows.reduce((sum, row) => sum + row.growthEpisodeCount, 0),
    causalClaimAllowed: false,
    rows,
    participationComparison: [{
      key: 'high',
      label: '考前至少 10 小時',
      students: 5,
      growthEpisodeCount: 0,
      avgActualGseGrowth: 0,
      avgAdjustedGseGrowth: null,
    }],
    skillGrowthSummary: [{
      skill: 'reading',
      sampleSize: 4,
      avgActualGseGrowth: 0,
      avgAdjustedGseGrowth: null,
    }],
  };
}

function skillRow(skill, sampleSize, actual) {
  return {
    skill,
    label: { listening: '聽力', reading: '閱讀', speaking: '口說', writing: '寫作' }[skill],
    sampleSize,
    actualGseGrowthAverage: actual,
    rawGrowthAverage: actual,
    growthStudentRatio: sampleSize > 0 && Number(actual) > 0 ? 0.5 : (sampleSize > 0 ? 0 : null),
    improvedCount: sampleSize > 0 && Number(actual) > 0 ? 2 : 0,
  };
}

function skillsPayload() {
  return {
    snapshotVersion: 'synth-1',
    causalClaimAllowed: false,
    growth: {
      summary: { retestCount: 6, excludedPlaceholderScoreRows: 1 },
      bySkill: [
        skillRow('listening', 0, null),
        skillRow('reading', 6, 0),
        skillRow('speaking', 6, 1.5),
      ],
      byStartingGse: [],
      episodes: [],
      improvedStudentsBySkill: {
        speaking: { studentIds: ['B11000001'], total: 1, truncated: false },
      },
    },
    growthEpisodes: { retestStudentCount: 6, bySkill: [], sampleEpisodes: [] },
    adjustedGrowth: { bySkill: [] },
  };
}

function groupFrom(route) {
  const url = new URL(route.request().url());
  const body = route.request().postDataJSON?.() || {};
  return url.searchParams.get('group_by') || body.group_by || 'department';
}

async function installMocks(page, { mode = 'ok', holdFirst = false } = {}) {
  const gate = { release() {} };
  let held = false;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (mode === 'deny') {
      await route.fulfill(json({ message: '沒有權限' }, 403));
      return;
    }
    if (url.includes('/learning-analytics/meta')) {
      await route.fulfill(json(meta));
      return;
    }
    if (url.includes('/learning-analytics/cohorts')) {
      if (mode === 'error') {
        await route.fulfill(json({}, 500));
        return;
      }
      if (mode === 'empty') {
        await route.fulfill(json({
          snapshotVersion: 'synth-1',
          rows: [],
          totalStudents: 0,
          totalGrowthEpisodes: 0,
          participationComparison: [],
          skillGrowthSummary: [],
        }));
        return;
      }
      const groupBy = groupFrom(route);
      if (holdFirst && !held && groupBy === 'department') {
        held = true;
        await new Promise((resolve) => {
          gate.release = resolve;
        });
      }
      try {
        await route.fulfill(json(cohortsPayload(groupBy)));
      } catch {
        // 後到的請求若已被頁面中止，不再寫回畫面。
      }
      return;
    }
    if (url.includes('/learning-analytics/skills')) {
      if (mode === 'error') {
        await route.fulfill(json({}, 500));
        return;
      }
      if (mode === 'slow') {
        await new Promise((resolve) => {
          gate.release = resolve;
        });
      }
      try {
        await route.fulfill(json(skillsPayload()));
      } catch {
        // aborted
      }
      return;
    }
    await route.fulfill(json({}));
  });
  return { releaseFirst: () => gate.release() };
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
}

function cohortGroup(page, name) {
  return page.locator('[data-testid="cohort-table"] td.la-offerings-name, [data-testid="cohort-cards"] h3').filter({ hasText: name });
}

async function expectNoPageOverflow(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth <= root.clientWidth + 1;
  });
  expect(overflow).toBe(true);
}

test.beforeEach(() => {
  fs.mkdirSync(outDir, { recursive: true });
});

test('opens cohorts, switches modes, and keeps browser history', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '群體與技能比較' })).toBeVisible();
  await expect(page.getByRole('link', { name: '群體比較' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.la-subnav-rows')).toHaveCount(0);
  await expect(cohortGroup(page, '外文系')).toBeVisible();
  await expect(page.getByRole('cell', { name: '無可比較樣本', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '0.0', exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('英檢工具')).toHaveCount(0);
  await shot(page, 'cohorts-desktop-after.png');
  await page.getByRole('button', { name: '查看 外文系 詳細資訊' }).click();
  await expect(page.getByTestId('cohort-table').getByText('快照 B2')).toBeVisible();
  await shot(page, 'cohorts-detail-after.png');
  await shot(page, 'cohorts-zero-sample-after.png');

  await page.getByRole('link', { name: '技能成長' }).click();
  await expect(page).toHaveURL(/\/learning-analytics\/skills/);
  await expect(page.getByRole('link', { name: '技能成長' })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.la-skill-growth-card', { hasText: '聽力' })).toContainText('無可比較樣本');
  await expect(page.locator('.la-skill-growth-card', { hasText: '閱讀' })).toContainText('0.0');
  await expect(page.locator('.la-skill-growth-card', { hasText: '口說' })).toContainText('+1.5');
  await expect(page.locator('.la-skill-growth-card', { hasText: '寫作' })).toContainText('未提供可判讀資料');
  await expect(page.getByText(/最明確|進步最多|最有效/)).toHaveCount(0);
  await expect(page.getByText('教學介入不足')).toHaveCount(0);
  await shot(page, 'skills-desktop-after.png');
  await shot(page, 'skills-four-skills-after.png');
  await shot(page, 'skills-missing-after.png');

  await page.goBack();
  await expect(page).toHaveURL(/\/learning-analytics\/cohorts/);
  await expect(page.getByRole('button', { name: '系所' })).toHaveAttribute('aria-pressed', 'true');
  await page.goForward();
  await expect(page).toHaveURL(/\/learning-analytics\/skills/);
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '群體與技能比較' })).toBeVisible();
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByTestId('cohort-table')).toBeVisible();
});

test('filters, grouping, and skill controls use each page contract', async ({ page }) => {
  await installMocks(page);
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(cohortGroup(page, '外文系')).toBeVisible();
  await page.getByLabel('學院').selectOption({ label: '文學院' });
  await page.getByLabel('系所').selectOption({ label: '外文系' });
  await page.getByLabel('入學年度').selectOption({ label: '113' });
  await page.getByLabel('資料版本').selectOption('synth-2');
  const [cohortRequest] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/learning-analytics/cohorts') && req.url().includes('college=')),
    page.getByRole('button', { name: '套用篩選' }).click(),
  ]);
  expect(cohortRequest.url()).toContain('department=');
  expect(cohortRequest.url()).toContain('cohort=113');
  expect(cohortRequest.url()).toContain('snapshot_version=synth-2');
  expect(cohortRequest.url()).not.toContain('instrument=');
  expect(cohortRequest.url()).not.toContain('skill=');
  expect(cohortRequest.url()).not.toContain('retest_flag=');

  const [groupRequest] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('group_by=college')),
    page.getByRole('button', { name: '學院' }).click(),
  ]);
  expect(groupRequest.url()).toContain('group_by=college');
  await expect(cohortGroup(page, '文學院')).toBeVisible();
  await expect(cohortGroup(page, '外文系')).toHaveCount(0);

  await page.goto('/admin/learning-analytics/skills?profile=admin');
  const filters = page.locator('.la-filters');
  await expect(filters.getByRole('combobox', { name: /技能/ })).toBeEnabled();
  await filters.getByRole('combobox', { name: /技能/ }).selectOption({ label: '聽力' });
  await filters.getByRole('combobox', { name: /英檢工具/ }).selectOption({ label: 'BESTEP' });
  await filters.getByRole('combobox', { name: /曾重測英檢/ }).selectOption({ label: '是' });
  const [skillRequest] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/learning-analytics/skills') && req.url().includes('skill=listening')),
    page.getByRole('button', { name: '套用篩選' }).click(),
  ]);
  expect(skillRequest.url()).toContain('instrument=BESTEP');
  expect(skillRequest.url()).toContain('retest_flag=true');
  const speaking = page.locator('.la-skill-growth-card', { hasText: '口說' });
  await speaking.getByRole('button', { name: /有進步學生/ }).click();
  await expect(page.getByText('口說有進步的學生')).toBeVisible();
  await expect(page.getByRole('button', { name: '前往原始資料匯出' })).toBeVisible();
  await expect(page.getByRole('button', { name: '匯出這批人的資料' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '看這批人的 B2 達標' })).toBeVisible();
  await page.getByRole('button', { name: '前往原始資料匯出' }).click();
  await expect(page).toHaveURL(/\/learning-analytics\/raw-data/);

  await page.goto('/admin/learning-analytics/skills?profile=learning');
  await page.locator('.la-skill-growth-card', { hasText: '口說' }).getByRole('button', { name: /有進步學生/ }).click();
  await expect(page.locator('.la-next-note')).toContainText('口說有進步的學生');
  await expect(page.getByRole('button', { name: '前往原始資料匯出' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '看這批人的 B2 達標' })).toBeVisible();
});

test('working set applies, pauses, and clears', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('eears.la.workingSet.v1', JSON.stringify({
      label: '合成名單',
      source: 'skills-improved',
      studentIds: ['B11000001'],
      total: 1,
      truncated: false,
      context: { snapshotVersion: 'synth-old', semester: '' },
    }));
  });
  await installMocks(page);
  const postPromise = page.waitForRequest((req) => (
    req.url().includes('/learning-analytics/cohorts') && req.method() === 'POST'
  ));
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByTestId('la-working-set')).toContainText('尚未套用');
  await shot(page, 'cohorts-working-set-paused-after.png');
  const post = page.waitForRequest((req) => (
    req.url().includes('/learning-analytics/cohorts') && req.method() === 'POST'
  ));
  await page.getByRole('button', { name: '沿用這份固定名單' }).click();
  const request = await post;
  expect(request.postDataJSON().studentIds).toEqual(['B11000001']);
  await expect(page.getByTestId('la-working-set')).toContainText('固定名單');
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  await expect(page.getByTestId('la-working-set')).toContainText('固定名單');
  await shot(page, 'skills-working-set-after.png');
  await page.getByRole('button', { name: '清除群體篩選' }).click();
  await expect(page.getByTestId('la-working-set')).toHaveCount(0);
  await postPromise;
});

test('empty, error, denied, and loading states', async ({ page }) => {
  await installMocks(page, { mode: 'empty' });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByText('這個分組沒有學生。不能因此說該群體沒有學習。')).toBeVisible();
  await shot(page, 'cohorts-empty-after.png');

  await page.unroute('**/api/**');
  await installMocks(page, { mode: 'error' });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByTestId('cohort-table')).toHaveCount(0);
  await expect(cohortGroup(page, '外文系')).toHaveCount(0);
  await shot(page, 'cohorts-error-after.png');

  await page.goto('/admin/learning-analytics/skills?profile=none');
  await expect(page.getByRole('heading', { name: '無權限檢視此頁面' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '群體與技能比較' })).toHaveCount(0);
  await shot(page, 'comparison-denied-after.png');

  await page.unroute('**/api/**');
  const { releaseFirst } = await installMocks(page, { mode: 'slow' });
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  await expect(page.locator('.spinner-border').first()).toBeVisible();
  await shot(page, 'skills-loading-after.png');
  releaseFirst();
  await expect(page.locator('.la-skill-growth-card__title', { hasText: '口說' })).toBeVisible();
});

test('an older cohort response cannot replace the newer group', async ({ page }) => {
  const { releaseFirst } = await installMocks(page, { holdFirst: true });
  const firstRequest = page.waitForRequest((req) => req.url().includes('/learning-analytics/cohorts'));
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await firstRequest;
  await page.getByRole('button', { name: '學院' }).click();
  await expect(cohortGroup(page, '文學院')).toBeVisible();
  releaseFirst();
  await page.waitForTimeout(300);
  await expect(cohortGroup(page, '文學院')).toBeVisible();
  await expect(cohortGroup(page, '外文系')).toHaveCount(0);
});

test('comparison pages stay readable across viewports', async ({ page }) => {
  await installMocks(page);
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/learning-analytics/cohorts?profile=admin');
    await expect(cohortGroup(page, '外文系')).toBeVisible();
    await expectNoPageOverflow(page);
    if (width < 768) {
      await expect(page.getByTestId('cohort-cards')).toBeVisible();
      await expect(page.getByTestId('cohort-table')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('cohort-table')).toBeVisible();
      await expect(page.getByTestId('cohort-cards')).toHaveCount(0);
    }
    await page.goto('/admin/learning-analytics/skills?profile=admin');
    await expect(page.locator('.la-skill-growth-card__title', { hasText: '聽力' })).toBeVisible();
    await expectNoPageOverflow(page);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  await shot(page, 'cohorts-mobile-after.png');
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  await expect(page.getByText('各技能平均 GSE 變化')).toHaveCount(0);
  await shot(page, 'skills-mobile-after.png');
});

test('captures the actual cohort and skill cards', async ({ page }) => {
  await installMocks(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  const mobileCards = page.getByTestId('cohort-cards');
  await expect(mobileCards).toContainText('外文系');
  await expect(mobileCards).toContainText('電機系');
  await expect(mobileCards).toContainText('無可比較樣本');
  await expect(mobileCards).toContainText('0.0');
  await expect(mobileCards).toContainText('學生數');
  await expectNoPageOverflow(page);
  await mobileCards.screenshot({ path: path.join(outDir, 'cohorts-mobile-cards-390.png') });
  const foreignCard = mobileCards.locator('.la-compare-card', { hasText: '外文系' });
  await foreignCard.locator('summary').click();
  await expect(foreignCard.locator('dt', { hasText: '快照 B2' })).toBeVisible();
  await expect(foreignCard.locator('dt', { hasText: '重測比例' })).toBeVisible();
  await mobileCards.screenshot({ path: path.join(outDir, 'cohorts-mobile-expanded-390.png') });

  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/admin/learning-analytics/skills?profile=admin');
  const skillCards = page.locator('.la-skill-growth-card');
  await expect(skillCards).toHaveCount(4);
  await expect(page.locator('.la-skill-growth-card', { hasText: '聽力' })).toContainText('無可比較樣本');
  await expect(page.locator('.la-skill-growth-card', { hasText: '閱讀' })).toContainText('0.0');
  await expect(page.locator('.la-skill-growth-card', { hasText: '口說' })).toContainText('+1.5');
  await expect(page.locator('.la-skill-growth-card', { hasText: '寫作' })).toContainText('未提供可判讀資料');
  await expectNoPageOverflow(page);
  await skillCards.nth(0).screenshot({ path: path.join(outDir, 'skills-mobile-cards-375.png') });
  await skillCards.nth(1).screenshot({ path: path.join(outDir, 'skills-mobile-cards-375-reading.png') });
  await skillCards.nth(2).screenshot({ path: path.join(outDir, 'skills-mobile-cards-375-speaking.png') });
  await skillCards.nth(3).screenshot({ path: path.join(outDir, 'skills-mobile-cards-375-writing.png') });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/learning-analytics/cohorts?profile=admin');
  const table = page.getByTestId('cohort-table');
  await expect(table).toBeVisible();
  await expect(page.getByRole('button', { name: '系所' })).toBeVisible();
  await expect(page.getByRole('button', { name: '學院' })).toBeVisible();
  await expect(page.getByRole('button', { name: '入學年度' })).toBeVisible();
  await expect(page.getByRole('button', { name: '資源參與量' })).toBeVisible();
  await expect(page.getByRole('button', { name: '起始能力' })).toBeVisible();
  await page.getByRole('cell', { name: '電機系', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'cohorts-desktop-final-1440.png'), fullPage: false });
  await page.getByRole('button', { name: '查看 電機系 詳細資訊' }).click();
  await expect(table.locator('dt', { hasText: '快照 B2' })).toBeVisible();
  await table.locator('dt', { hasText: '快照 B2' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'cohorts-desktop-expanded-1440.png'), fullPage: false });
});
