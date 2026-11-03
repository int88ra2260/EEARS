import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('review-output/resources-ux-r4');
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
  snapshotVersionCount: 1,
  snapshots: [{ snapshotVersion: 'synth-1', label: '合成快照', scope: 'global' }],
  filterOptions: {
    cohorts: [{ value: '113', label: '113' }],
    colleges: ['文學院'],
    departments: ['外文系'],
    semesters: [{ value: '115-1', label: '115-1學期' }, { value: '114-2', label: '114-2學期' }],
  },
  causalClaimAllowed: false,
};

function resourcesPayload(cohort) {
  if (cohort === '113') {
    return {
      snapshotVersion: 'synth-1',
      causalClaimAllowed: false,
      resourceEffectiveness: [{
        resourceType: 'EAP',
        participantCount: 3,
        growthSampleSize: 3,
        rawGrowthAverage: 0.5,
        evidenceLevel: 'descriptive_medium',
        causalClaimAllowed: false,
        mainSkills: ['writing'],
      }],
      skillExposure: { byResource: [{ resourceType: 'EAP', events: 9 }] },
    };
  }
  return {
    snapshotVersion: 'synth-1',
    causalClaimAllowed: false,
      resourceEffectiveness: [
      {
        resourceType: 'GE',
        participantCount: 12,
        growthSampleSize: 0,
        rawGrowthAverage: 0,
        evidenceLevel: 'descriptive_low',
        causalClaimAllowed: false,
        mainSkills: ['reading'],
      },
      {
        resourceType: 'ET',
        participantCount: 0,
        growthSampleSize: 0,
        rawGrowthAverage: 0,
        evidenceLevel: 'descriptive_low',
        causalClaimAllowed: false,
        mainSkills: [],
      },
      {
        resourceType: 'ENGLISH_TABLE',
        participantCount: 6,
        growthSampleSize: 4,
        rawGrowthAverage: 0,
        evidenceLevel: 'descriptive_medium',
        causalClaimAllowed: false,
        mainSkills: ['speaking'],
      },
      {
        resourceType: 'JOB_TALK',
        participantCount: 6,
        growthSampleSize: 4,
        rawGrowthAverage: 1.2,
        evidenceLevel: 'descriptive_medium',
        causalClaimAllowed: false,
        mainSkills: ['speaking'],
      },
      {
        resourceType: 'WORKSHOP',
        participantCount: 6,
        growthSampleSize: 4,
        rawGrowthAverage: -0.4,
        evidenceLevel: 'descriptive_medium',
        causalClaimAllowed: false,
        mainSkills: ['writing'],
      },
      {
        resourceType: 'ESP',
        participantCount: 6,
        growthSampleSize: 4,
        rawGrowthAverage: null,
        evidenceLevel: 'descriptive_medium',
        causalClaimAllowed: false,
        mainSkills: ['reading'],
      },
    ],
    skillExposure: { byResource: [{ resourceType: 'GE', events: 30 }] },
  };
}

function offeringLabel(dimension) {
  return {
    course: '通識英文（一）',
    instructor: '合成教師',
    activity: '合成活動',
    resource_category: '資源類別：通識英文',
  }[dimension] || dimension;
}

function offeringsPayload(dimension, semester) {
  const primary = {
    offeringKey: `${semester || 'all'}::${dimension}`,
    label: offeringLabel(dimension),
    courseCode: 'GE101',
    semesterId: semester || null,
    semesterLabel: semester || '跨學期',
    participantCount: 8,
    growthSampleSize: 0,
    avgRawDelta: 0,
    causalClaimAllowed: false,
    direction: { improved: 0, flat: 0, declined: 0, total: 0 },
    improvement: { any: { studentCount: 1, rate: 0.125, label: '至少一項' }, allSkills: null },
    skillBreakdown: [{ skill: 'reading', participantCount: 8, growthSampleSize: 0, avgRawDelta: 0 }],
  };
  const observed = dimension === 'course' ? [
    { ...primary, offeringKey: `${semester || 'all'}::zero`, label: '變化為零的課', growthSampleSize: 6, avgRawDelta: 0, skillBreakdown: [{ skill: 'reading', participantCount: 6, growthSampleSize: 6, avgRawDelta: 0 }] },
    { ...primary, offeringKey: `${semester || 'all'}::up`, label: '正成長的課', growthSampleSize: 6, avgRawDelta: 1.2 },
    { ...primary, offeringKey: `${semester || 'all'}::down`, label: '負成長的課', growthSampleSize: 6, avgRawDelta: -0.8 },
    { ...primary, offeringKey: `${semester || 'all'}::missing`, label: '缺值的課', growthSampleSize: 6, avgRawDelta: null },
  ] : [];
  const rows = [primary, ...observed];
  return {
    dimension,
    semester: semester || null,
    snapshotVersion: 'synth-1',
    rowCount: rows.length,
    minGrowthSample: 10,
    causalClaimAllowed: false,
    rows,
  };
}

async function installMocks(page, { mode = 'ok', holdFirst = false } = {}) {
  let releaseFirst;
  const gate = holdFirst ? new Promise((resolve) => { releaseFirst = resolve; }) : null;
  let resourcesCalls = 0;
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const requestUrl = new URL(url);
    if (mode === 'deny') {
      await route.fulfill(json({ message: '沒有權限' }, 403));
      return;
    }
    if (url.includes('/learning-analytics/meta')) {
      await route.fulfill(json(meta));
      return;
    }
    if (url.includes('/learning-analytics/resources')) {
      resourcesCalls += 1;
      if (mode === 'error') {
        await route.fulfill(json({}, 500));
        return;
      }
      if (mode === 'empty') {
        await route.fulfill(json({
          snapshotVersion: 'synth-1',
          causalClaimAllowed: false,
          resourceEffectiveness: [],
          skillExposure: { byResource: [] },
        }));
        return;
      }
      const body = route.request().postDataJSON?.() || {};
      const cohort = requestUrl.searchParams.get('cohort') || body.cohort || '';
      if (holdFirst && resourcesCalls === 1) await gate;
      await route.fulfill(json(resourcesPayload(cohort)));
      return;
    }
    if (url.includes('/offerings/export')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers: { 'Content-Disposition': 'attachment; filename="offerings.xlsx"' },
        body: Buffer.from('PK'),
      });
      return;
    }
    if (url.includes('/offerings/detail')) {
      await route.fulfill(json({
        students: [{ studentId: 'B11000001', avgRawDelta: null }],
      }));
      return;
    }
    if (url.includes('/learning-analytics/offerings')) {
      const body = route.request().postDataJSON?.() || {};
      const dimension = requestUrl.searchParams.get('dimension') || body.dimension || 'course';
      const semester = requestUrl.searchParams.get('semester') || body.semester || '';
      await route.fulfill(json(offeringsPayload(dimension, semester)));
      return;
    }
    await route.fulfill(json({}));
  });
  return { releaseFirst };
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test('resources and offerings workspace', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toBeVisible();
  await expect(page.getByRole('link', { name: '參與與覆蓋' })).toHaveClass(/active/);
  await expect(page.getByRole('cell', { name: '有人參與，但沒有可比較的前後測' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '沒有人參與' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '30', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '無可比較樣本' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: '0.0', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '+1.2', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '-0.4', exact: true })).toBeVisible();
  const missingRow = page.getByRole('row', { name: /ESP 專業英文/ });
  await expect(missingRow).toContainText('—');
  await expect(missingRow).not.toContainText('0.0');
  await expect(page.getByLabel('學期')).toHaveCount(0);
  fs.mkdirSync(outDir, { recursive: true });
  await page.getByRole('row', { name: /通識英文/ }).screenshot({ path: path.join(outDir, 'resources-zero-sample.png') });
  await page.getByRole('row', { name: /English Table/ }).screenshot({ path: path.join(outDir, 'resources-true-zero.png') });
  await shot(page, 'resources-desktop-after.png');

  await page.getByRole('link', { name: '課程與活動觀察' }).click();
  await expect(page).toHaveURL(/\/learning-analytics\/offerings/);
  await expect(page.locator('.admin-topbar')).toHaveCount(1);
  await page.screenshot({ path: path.join(outDir, 'offerings-topbar-viewport.png'), fullPage: false });
  await expect(page.getByTestId('offering-scale-warning')).toContainText('暫不建議把 GSE 或校正後變化當作正式比較');
  await expect(page.getByTestId('offering-scale-warning')).not.toContainText('請重啟');
  await page.getByText('指標定義', { exact: true }).click();
  await expect(page.getByText('其中有前測也有後測、可以比較後來差多少的人數。')).toBeVisible();
  await expect(page.getByTestId('la-scope-note')).toContainText('目前範圍：');
  await page.getByRole('button', { name: '教師' }).click();
  await expect(page.getByRole('cell', { name: '合成教師', exact: true })).toBeVisible();
  await page.getByLabel('顯示進階欄位（技能定義／GSE）').check();
  await expect(page.getByRole('columnheader', { name: '至少一項變好' }).first()).toBeVisible();
  await shot(page, 'offerings-advanced-after.png');
  await page.getByTitle('展開技能與學生明細').click();
  await expect(page.getByText('各技能明細')).toBeVisible();
  await expect(page.getByRole('cell', { name: '合成教師', exact: true })).toBeVisible();
  await shot(page, 'offerings-detail-after.png');
  await page.getByTitle('收合明細').click();
  await expect(page.getByText('各技能明細')).toBeHidden();

  await expect(page).toHaveURL(/dimension=instructor/);
  await page.goBack();
  await expect(page).toHaveURL(/\/learning-analytics\/offerings/);
  await page.goBack();
  await expect(page).toHaveURL(/\/learning-analytics\/resources/);
  await expect(page.getByText('通識英文')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, 'resources-mobile-after.png');
  expect(await overflowX(page)).toBeLessThanOrEqual(1);
  await page.getByRole('link', { name: '課程與活動觀察' }).click();
  await expect(page.getByTestId('offering-cards')).toBeVisible();
  await expect(page.getByRole('heading', { name: '通識英文（一）' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '參與人數' })).toHaveCount(0);
  await shot(page, 'offerings-mobile-after.png');
  const emptyCard = page.getByTestId('offering-card').filter({ hasText: '通識英文（一）' });
  await expect(emptyCard.getByText('樣本不足，無法判讀平均變化')).toBeVisible();
  await emptyCard.getByRole('button', { name: '查看詳細資料' }).click();
  await expect(emptyCard.getByText('各技能明細')).toBeVisible();
  await expect(emptyCard.getByText('閱讀')).toBeVisible();
  await expect(emptyCard.getByText('無可比較樣本').first()).toBeVisible();
  const zeroCard = page.getByTestId('offering-card').filter({ hasText: '變化為零的課' });
  await expect(zeroCard.getByText('可觀察的前後測變化 0.0')).toBeVisible();
  await shot(page, 'offerings-mobile-expanded.png');
  await emptyCard.getByText('各技能明細').screenshot({ path: path.join(outDir, 'offerings-mobile-skills.png') });
  expect(await overflowX(page)).toBeLessThanOrEqual(1);
});

test('viewport overflow stays on the page', async ({ page }) => {
  await installMocks(page);
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/learning-analytics/resources?profile=admin');
    await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toBeVisible();
    expect(await overflowX(page), `${width} resources`).toBeLessThanOrEqual(1);
    await page.goto('/admin/learning-analytics/offerings?profile=admin');
    await expect(page.getByText('通識英文（一）')).toBeVisible();
    if (width < 768) {
      await expect(page.getByTestId('offering-cards')).toBeVisible();
      await expect(page.getByRole('columnheader', { name: '參與人數' })).toHaveCount(0);
    } else {
      await expect(page.getByRole('columnheader', { name: '參與人數' })).toBeVisible();
      await expect(page.getByTestId('offering-cards')).toHaveCount(0);
    }
    expect(await overflowX(page), `${width} offerings`).toBeLessThanOrEqual(1);
  }
});

test('mobile cards stay readable for every offering dimension', async ({ page }) => {
  await installMocks(page);
  const dimensions = [
    ['課程', '通識英文（一）'],
    ['教師', '合成教師'],
    ['個別活動', '合成活動'],
    ['資源類別（通識英文等）', '資源類別：通識英文'],
  ];
  for (const [width, height] of [[390, 844], [375, 667]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/learning-analytics/offerings?profile=admin');
    for (const [button, label] of dimensions) {
      await page.getByRole('button', { name: button, exact: true }).click();
      const card = page.getByTestId('offering-card').filter({ hasText: label });
      await expect(card).toBeVisible();
      await expect(card.getByText('8 人')).toBeVisible();
      await expect(card.getByText('0 人')).toBeVisible();
      await expect(card.getByText('樣本不足，無法判讀平均變化')).toBeVisible();
      await card.getByRole('button', { name: '查看詳細資料' }).focus();
      await page.keyboard.press('Enter');
      await expect(card.getByText('各技能明細')).toBeVisible();
      await expect(card.getByText('閱讀')).toBeVisible();
      await card.getByRole('button', { name: '收合明細' }).click();
      await expect(card.getByText('各技能明細')).toBeHidden();
      expect(await overflowX(page), `${width} ${button}`).toBeLessThanOrEqual(1);
    }
  }
  await page.screenshot({ path: path.join(outDir, 'offerings-mobile-375.png'), fullPage: true });
});

test('working set applies and pauses', async ({ page }) => {
  await installMocks(page);
  await page.addInitScript(() => {
    sessionStorage.setItem('eears.la.workingSet.v1', JSON.stringify({
      label: '合成名單',
      studentIds: ['B11000001', 'B11000002'],
      total: 2,
      truncated: false,
      context: { snapshotVersion: 'synth-1', semester: '115-1' },
    }));
  });
  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await expect(page.getByTestId('la-working-set')).toContainText('2 人');
  await expect(page.getByTestId('la-working-set')).toContainText('沒有依這頁條件重篩');
  await shot(page, 'working-set-applied.png');
  await page.goto('/admin/learning-analytics/offerings?semester=114-2&profile=admin');
  await expect(page.getByTestId('la-working-set')).toContainText('尚未套用');
  await shot(page, 'working-set-paused.png');
  await page.getByRole('button', { name: '清除群體篩選' }).click();
  await expect(page.getByTestId('la-working-set')).toHaveCount(0);
});

test('export follows permission and the current query', async ({ page }) => {
  await installMocks(page);
  await page.goto('/admin/learning-analytics/offerings?dimension=activity&profile=learning');
  await expect(page.getByText('您目前僅可檢視細項分析')).toBeVisible();
  await expect(page.getByRole('button', { name: '下載目前結果' })).toBeDisabled();

  await page.goto('/admin/learning-analytics/offerings?dimension=activity&profile=admin');
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('/offerings/export')),
    page.getByRole('button', { name: '下載目前結果' }).click(),
  ]);
  expect(request.url()).toContain('dimension=activity');
});

test('empty, error, and denied states', async ({ page }) => {
  await installMocks(page, { mode: 'empty' });
  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await expect(page.getByText('尚無可用紀錄。不能推論沒有學習。')).toBeVisible();
  await shot(page, 'resources-insufficient-after.png');

  await page.unroute('**/api/**');
  await installMocks(page, { mode: 'error' });
  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByText('通識英文')).toHaveCount(0);

  await page.goto('/admin/learning-analytics/resources?profile=none');
  await expect(page.getByRole('heading', { level: 1, name: '資源與開課分析' })).toHaveCount(0);
  await shot(page, 'resources-denied-after.png');
});

test('an older resources response cannot replace the newer cohort', async ({ page }) => {
  const { releaseFirst } = await installMocks(page, { holdFirst: true });
  await page.goto('/admin/learning-analytics/resources?profile=admin');
  await page.getByLabel('入學年度').selectOption('113');
  await page.getByRole('button', { name: '套用篩選' }).click();
  releaseFirst();
  await expect(page.getByText('EAP 寫作／學術英文')).toBeVisible();
  await expect(page.getByText('通識英文')).toHaveCount(0);
});

test('clearing the semester shows a cross-semester range', async ({ page }) => {
  await installMocks(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/learning-analytics/offerings?profile=admin');
  await page.getByLabel('學期').selectOption('');
  await page.getByRole('button', { name: '套用篩選' }).click();
  await expect(page.getByTestId('offering-cross-semester')).toHaveText('目前範圍：跨學期');
  await shot(page, 'offerings-desktop-after.png');
});
