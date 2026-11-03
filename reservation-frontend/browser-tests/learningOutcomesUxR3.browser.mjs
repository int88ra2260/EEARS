import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const phase = process.env.UX_R3_PHASE === 'after' ? 'after' : 'before';
const outDir = path.resolve('review-output/learning-outcomes-ux-r3');

function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: status < 400, data }),
  };
}

const overviewPayload = {
  hasData: true,
  snapshotVersion: 'synth-1',
  headline: {
    studentsInAnalysis: 120,
    studentsWithValidExam: 80,
    studentsWithMultipleExams: 40,
    studentsWithBaseline: 90,
    studentsWithSingleExam: 40,
  },
  cefrDistribution: {
    baseline: [
      { level: 'A2', count: 30 },
      { level: 'B1', count: 50 },
      { level: 'B2', count: 10 },
    ],
    currentBest: [
      { level: 'A2', count: 20 },
      { level: 'B1', count: 40 },
      { level: 'B2', count: 20 },
    ],
  },
  resourceParticipation: [
    { resourceType: 'et', label: '英語輔導', hours: 120 },
    { resourceType: 'ec', label: '英語會話', hours: 80 },
  ],
  resourceRanking: [
    { resourceType: 'et', growthSampleSize: 12 },
    { resourceType: 'ec', growthSampleSize: 8 },
  ],
  evidenceQuality: [{ level: 'high', label: '完整', count: 40 }],
  disclaimers: ['合成資料。不可把資源參與說成能力成長的原因。'],
};

async function installMocks(page, { deny = false } = {}) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (deny) {
      await route.fulfill(json({ message: '沒有權限' }, 403));
      return;
    }
    if (url.includes('/learning-analytics/meta')) {
      await route.fulfill(json({
        hasAnalyticData: true,
        recommendedSnapshotVersion: 'synth-1',
        recommendedSnapshot: { version: 'synth-1', label: '合成快照', studentCount: 120, examCount: 200 },
        snapshots: [{ snapshotVersion: 'synth-1', label: '合成快照 synth-1', scope: 'global' }],
        filterOptions: {
          entryYears: ['113'],
          colleges: ['文學院'],
          departments: ['外文系'],
        },
        officialUseAllowed: false,
        causalClaimAllowed: false,
      }));
      return;
    }
    if (url.includes('/learning-analytics/overview')) {
      await route.fulfill(json(overviewPayload));
      return;
    }
    if (url.includes('/kpi/policies') && method === 'GET') {
      await route.fulfill(json([{
        id: 1,
        name: '聽讀說寫成對（合成）',
        policyKey: 'pair-bothcefr-samedate-g24',
        isBuiltin: true,
        isArchived: false,
        version: 1,
      }]));
      return;
    }
    if (url.includes('/kpi/report') && method === 'POST' && !url.includes('export')) {
      const body = route.request().postDataJSON() || {};
      const semesterId = String(body.semesterId || '').trim() || '115-1';
      const totalStudents = semesterId === '114-2' ? 80 : 100;
      const listeningRate = semesterId === '114-2' ? 0.5 : 0.4;
      await route.fulfill(json({
        generatedAt: '2026-11-03T05:00:00.000Z',
        policy: { id: 1, name: '聽讀說寫成對（合成）' },
        population: {
          totalStudents,
          semesterId,
          note: '指定學期名冊',
        },
        summary: {
          dimensions: [
            { id: 'lr', label: '聽讀成對', rate: listeningRate, passedCount: Math.round(listeningRate * totalStudents) },
            { id: 'sw', label: '說寫成對', rate: 0.25, passedCount: 20 },
          ],
        },
        rows: [{
          studentId: 'B11000001',
          grade: '四',
          dimensions: {
            lr: { passed: true, proof: '聽讀同日 CEFR' },
            sw: { passed: false, proof: '口說缺成績' },
          },
        }],
      }));
      return;
    }
    if (url.includes('/kpi/report/export') || url.includes('/kpi/gaps')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body: Buffer.from('PK'),
      });
      return;
    }
    if (url.includes('/b2-report')) {
      const semesterId = decodeURIComponent(url.split('/semesters/')[1]?.split('/')[0] || '115-1');
      await route.fulfill(json({
        semesterId,
        totalStudents: 40,
        skills: {
          listening: { count: 30, rate: 0.75 },
          reading: { count: 28, rate: 0.7 },
          speaking: { count: 10, rate: 0.25 },
          writing: { count: 12, rate: 0.3 },
        },
      }));
      return;
    }
    if (url.includes('/analytics/summary')) {
      await route.fulfill(json({
        snapshotVersion: 'synth-global',
        totals: {
          students: 500,
          b2plusRate: 0.22,
          b2plusCount: 110,
          multiExamStudents: 80,
          retestStudents: 40,
          improvedExamRows: 15,
        },
        notes: ['這是全域快照，不是 115-1 名冊。'],
      }));
      return;
    }
    if (url.includes('/students')) {
      await route.fulfill(json({
        items: [
          {
            studentId: 'B11000001',
            studentName: '合成甲',
            grade: '2',
            department: '外文系',
            bestSkills: {
              listening: { cefr: 'B2', rank: 4 },
              reading: { cefr: 'B2', rank: 4 },
              speaking: { cefr: 'B1', rank: 3 },
              writing: { cefr: 'B1', rank: 3 },
            },
          },
          {
            studentId: 'B11000002',
            studentName: '合成乙',
            grade: '2',
            department: '外文系',
            bestSkills: {
              listening: { cefr: 'B1', rank: 3 },
              reading: { cefr: 'B1', rank: 3 },
              speaking: { cefr: 'A2', rank: 2 },
              writing: { cefr: 'B1', rank: 3 },
            },
          },
        ],
        pagination: { total: 40, limit: 20, offset: 0, returned: 2 },
        filters: { departments: ['外文系'], grades: ['2'] },
      }));
      return;
    }
    if (url.includes('/breakdown')) {
      await route.fulfill(json([{
        group: '2',
        totalStudents: 40,
        skills: {
          listening: { count: 30, rate: 0.75 },
          reading: { count: 28, rate: 0.7 },
          speaking: { count: 10, rate: 0.25 },
          writing: { count: 12, rate: 0.3 },
        },
      }]));
      return;
    }
    await route.fulfill(json({}));
  });
}

async function shot(page, name) {
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: true,
  });
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe(`learning outcomes ux r3 (${phase})`, () => {
  test('overview, kpi, journey', async ({ page }) => {
    await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/admin/learning-analytics/overview?profile=admin');
    if (phase === 'before') {
      await expect(page.getByRole('heading', { name: '總覽' })).toBeVisible();
      await expect(page.getByText('英語中心資源參與')).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: '學習成效概況' })).toBeVisible();
      await expect(page.getByText('分析範圍：學習成效快照')).toBeVisible();
      await expect(page.locator('.outcomes-mode').getByRole('link', { name: '學期 B2 KPI' })).toBeVisible();
      await expect(page.getByText('資源參與摘要')).toBeVisible();
      await expect(page.getByText('英語中心資源參與')).toBeHidden();
    }
    await expect(page.getByText('納入快照學生')).toBeVisible();
    await shot(page, `overview-desktop-${phase}.png`);

    if (phase === 'after') {
      await page.locator('.outcomes-mode').getByRole('link', { name: '學期 B2 KPI' }).click();
      await expect(page).toHaveURL(/kpi-report/);
      await page.goBack();
      await expect(page).toHaveURL(/learning-analytics\/overview/);
    }

    await page.goto('/admin/learning-analytics/kpi-report?profile=admin');
    if (phase === 'before') {
      await expect(page.getByRole('heading', { name: 'B2 KPI 報表' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '政策庫管理' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { level: 1, name: '學期 B2 KPI' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: '學期 B2 KPI' })).toBeVisible();
      await expect(page.getByText('分析範圍：指定學期名冊與 KPI 政策')).toBeVisible();
      await expect(page.getByRole('heading', { name: '政策庫管理' })).toHaveCount(0);
    }
    await shot(page, `kpi-desktop-${phase}.png`);

    await page.getByRole('button', { name: '執行報表' }).click();
    await expect(page.getByRole('columnheader', { name: '聽讀成對' })).toBeVisible();
    await expect(page.getByText('B11000001')).toBeVisible();
    if (phase === 'after') {
      await page.getByLabel('名冊學期').selectOption('114-2');
      await expect(page.getByText('請重新執行報表')).toBeVisible();
      await expect(page.getByText('40.0%')).toHaveCount(0);
      await shot(page, 'kpi-desktop-after-stale.png');
      await page.getByRole('button', { name: '執行報表' }).click();
      await expect(page.getByText('結果學期 114-2')).toBeVisible();
      await expect(page.getByText('50.0%')).toBeVisible();
      await expect(page.getByText('結果學期 115-1')).toHaveCount(0);
      await expect(page.getByText('2026-11-03T05:00:00.000Z')).toHaveCount(0);
      await expect(page.getByText('13:00')).toBeVisible();
      await expect(page.getByText('這份報表的學生', { exact: true })).toBeVisible();
      await expect(page.getByText('未達標的學生', { exact: true })).toBeVisible();
      await expect(page.getByText('接下來看這批人')).toHaveCount(0);
      await page.getByRole('button', { name: '管理政策' }).click();
      await expect(page.getByRole('heading', { name: '政策庫管理' })).toBeVisible();
    }
    await shot(page, phase === 'after' ? 'kpi-desktop-after-ran.png' : 'kpi-desktop-before-ran.png');

    await page.goto('/admin/learning-journey?semester=115-1&profile=admin');
    await expect(page.locator('div').filter({ hasText: /^聽力 B2\+$/ })).toBeVisible();
    if (phase === 'before') {
      await expect(page.getByText('成效分析摘要')).toBeVisible();
      await expect(page.getByText('B2+ 達標率')).toBeVisible();
    } else {
      await expect(page.getByText('資料範圍：學期名冊', { exact: true })).toBeVisible();
      await expect(page.getByText('B2+ 達標率')).toHaveCount(0);
      await expect(page.getByText('總筆數：40')).toBeVisible();
      await expect(page.getByText('B11000001')).toBeVisible();
      await expect(page.getByText('總筆數：0')).toHaveCount(0);
      await expect(page.getByRole('link', { name: '查看學習成效分析' })).toBeVisible();
    }
    await shot(page, `journey-${phase}.png`);

    for (const [width, height] of [[1280, 800], [768, 1024], [390, 844], [375, 667]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/admin/learning-analytics/overview?profile=admin');
      await expect(page.getByText('納入快照學生')).toBeVisible();
      expect(await overflowX(page)).toBeLessThanOrEqual(1);
      if (phase === 'after' && width === 390) {
        await shot(page, 'overview-mobile-after.png');
      }
      await page.goto('/admin/learning-analytics/kpi-report?profile=admin');
      await expect(page.getByRole('button', { name: '執行報表' })).toBeVisible();
      expect(await overflowX(page)).toBeLessThanOrEqual(1);
      if (phase === 'after' && width === 390) {
        await shot(page, 'kpi-mobile-after.png');
      }
    }
  });

  test('denied profile cannot open overview', async ({ page }) => {
    await installMocks(page, { deny: true });
    await page.goto('/admin/learning-analytics/overview?profile=none');
    await expect(page.getByText('納入快照學生')).toHaveCount(0);
  });

  test('a slower earlier KPI response cannot replace the later semester', async ({ page }) => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    let kpiPosts = 0;
    await installMocks(page);
    await page.unroute('**/api/**');
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      if (url.includes('/kpi/policies') && method === 'GET') {
        await route.fulfill(json([{
          id: 1,
          name: '聽讀說寫成對（合成）',
          policyKey: 'pair-bothcefr-samedate-g24',
          isBuiltin: true,
          isArchived: false,
        }]));
        return;
      }
      if (url.includes('/kpi/report') && method === 'POST' && !url.includes('export')) {
        kpiPosts += 1;
        const body = route.request().postDataJSON() || {};
        const semesterId = String(body.semesterId || '').trim();
        if (kpiPosts === 1) await firstGate;
        const totalStudents = semesterId === '114-2' ? 80 : 100;
        await route.fulfill(json({
          generatedAt: '2026-11-03T05:00:00.000Z',
          policy: { name: '聽讀說寫成對（合成）' },
          population: { totalStudents, semesterId, note: '指定學期名冊' },
          summary: {
            dimensions: [
              { id: 'lr', label: '聽讀成對', rate: semesterId === '114-2' ? 0.5 : 0.4, passedCount: semesterId === '114-2' ? 40 : 40 },
            ],
          },
          rows: [],
        }));
        return;
      }
      await route.fulfill(json({}));
    });
    await page.goto('/admin/learning-analytics/kpi-report?profile=admin');
    await page.getByRole('button', { name: '執行報表' }).click();
    await page.getByLabel('名冊學期').selectOption('114-2');
    releaseFirst();
    await expect(page.getByText('請重新執行報表')).toBeVisible();
    await expect(page.getByText('結果學期 115-1')).toHaveCount(0);
    await page.getByRole('button', { name: '執行報表' }).click();
    await expect(page.getByText('結果學期 114-2')).toBeVisible();
    await expect(page.getByText('結果學期 115-1')).toHaveCount(0);
  });

  test('view-only profile does not see policy management controls', async ({ page }) => {
    await installMocks(page);
    await page.goto('/admin/learning-analytics/kpi-report?profile=learning');
    await expect(page.getByRole('button', { name: '執行報表' })).toBeVisible();
    await expect(page.getByRole('button', { name: '管理政策' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '政策庫管理' })).toHaveCount(0);
    await expect(page.getByText('目前可選用既有政策執行報表')).toBeVisible();
  });
});
