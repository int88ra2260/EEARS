import { test, expect } from '@playwright/test';

const HARNESS = '/browser-tests/bestep.html';
const CLASS_ID = 'SYN-CLASS';
const OVERVIEW_PATH = `/api/admin/classes/${CLASS_ID}/bestep-overview`;
const HARNESS_TOKEN = 'bestep-browser-harness';
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];

function skill(attended) {
  return { L: { attended }, R: { attended }, S: { attended }, W: { attended } };
}

function student(overrides) {
  return {
    studentId: 'SYN-N1-A',
    studentName: '合成甲',
    department: '合成學系',
    email: null,
    personalRegistration: {
      status: 'success',
      examType: 'LRSW',
      examTypeLabel: '聽讀說寫',
      exemptionType: '無',
    },
    groupRegistration: null,
    attendance: skill(true),
    score: null,
    ...overrides,
  };
}

function roster() {
  return [
    student({
      studentId: 'SYN-N1-A',
      studentName: '合成甲',
      department: '合成學系名稱用來檢查表格排版',
      attendance: skill(true),
    }),
    student({
      studentId: 'SYN-N1-B',
      studentName: '合成乙',
      attendance: skill(false),
    }),
    student({
      studentId: 'SYN-N1-C',
      studentName: '合成丙',
      attendance: skill(null),
    }),
    student({
      studentId: 'SYN-N1-D',
      studentName: '合成丁',
      attendance: { L: {}, R: {}, S: {}, W: {} },
    }),
    student({
      studentId: 'SYN-N1-E',
      studentName: '合成戊',
      attendance: {},
    }),
    student({
      studentId: 'SYN-N1-F',
      studentName: '合成己',
      personalRegistration: {
        status: 'success',
        examType: 'LRSW',
        examTypeLabel: '聽讀說寫',
        exemptionType: '聽讀說寫',
        exemption_review_status: 'approved',
        exemptionVerifiedType: 'LRSW',
      },
      attendance: {},
    }),
    student({
      studentId: 'SYN-N1-G',
      studentName: '合成庚',
      personalRegistration: null,
      attendance: {},
    }),
    student({
      studentId: 'SYN-N1-H',
      studentName: '合成辛',
      attendance: { L: { attended: true } },
      score: {
        totalScore: 0,
        listeningLevel: 'B2',
        readingLevel: 'B2',
        speakingLevel: 'B2',
        writingLevel: 'B2',
        passed: false,
      },
    }),
  ];
}

function pageTwoStudent() {
  return student({
    studentId: 'SYN-N1-P2',
    studentName: '合成第二頁',
    attendance: { L: { attended: true } },
  });
}

function overviewBody(url) {
  const page = Number(url.searchParams.get('page') || '1');
  const search = url.searchParams.get('search') || '';
  const semester = url.searchParams.get('semester');
  let students = roster();
  if (search) {
    students = students.filter((row) => row.studentId.includes(search) || row.studentName.includes(search));
  } else if (page === 2) {
    students = [pageTwoStudent()];
  }
  return {
    classInfo: {
      classId: CLASS_ID,
      className: '合成班',
      teacherName: '合成教師',
      semester,
    },
    statistics: {
      domesticStudentCount: 7,
      totalStudents: 8,
      registrationRate: 0,
      totalExamCount: 0,
      registrationDenominator: 0,
      attendanceRate: null,
      attendedSlots: 0,
      totalRegistrationExamSlots: 0,
      passedCount: 1,
      passRate: 100,
      avgScore: null,
    },
    students,
    pagination: {
      page,
      pageSize: Number(url.searchParams.get('pageSize') || '50'),
      total: search ? students.length : 9,
      totalPages: search ? 1 : 2,
    },
  };
}

async function installIsolation(page, mode) {
  let releaseGate = () => {};
  let gate = Promise.resolve();
  if (mode === 'loading') {
    gate = new Promise((resolve) => {
      releaseGate = resolve;
    });
  }
  const state = {
    mode,
    release: releaseGate,
    calls: [],
    blocked: [],
    consoleErrors: [],
    pageErrors: [],
  };

  await page.addInitScript((token) => {
    localStorage.setItem('token', token);
  }, HARNESS_TOKEN);

  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => {
    state.pageErrors.push(String(error));
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || (url.pathname.startsWith('/api/') && url.pathname !== OVERVIEW_PATH)) {
      state.blocked.push(url.href);
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await page.route(`**${OVERVIEW_PATH}**`, async (route) => {
    const url = new URL(route.request().url());
    const authorization = route.request().headers().authorization || '';
    state.calls.push({
      path: url.pathname,
      method: route.request().method(),
      semester: url.searchParams.get('semester'),
      examType: url.searchParams.get('examType'),
      page: url.searchParams.get('page'),
      search: url.searchParams.get('search'),
      authorization,
    });
    if (url.pathname !== OVERVIEW_PATH) {
      state.blocked.push(url.href);
      await route.abort();
      return;
    }
    await gate;
    if (state.mode === 'error') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '合成載入失敗' }),
      });
      return;
    }
    if (state.mode === 'empty') {
      const body = overviewBody(url);
      body.students = [];
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
      body: JSON.stringify(overviewBody(url)),
    });
  });

  return state;
}

async function openHarness(page, mode = 'normal') {
  const state = await installIsolation(page, mode);
  await page.goto(HARNESS);
  await expect(page).toHaveURL(/127\.0\.0\.1:3017\/browser-tests\/bestep\.html/);
  return state;
}

function row(page, id) {
  return page.getByRole('row').filter({ hasText: id });
}

async function contrastRatio(locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const parse = (color) => {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return null;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const linear = (channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => (0.2126 * linear(rgb[0])) + (0.7152 * linear(rgb[1])) + (0.0722 * linear(rgb[2]));
    const foreground = parse(style.color);
    const background = parse(style.backgroundColor);
    if (!foreground || !background || style.backgroundColor === 'rgba(0, 0, 0, 0)') {
      return { color: style.color, background: style.backgroundColor, ratio: null };
    }
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return {
      color: style.color,
      background: style.backgroundColor,
      ratio: (lighter + 0.05) / (darker + 0.05),
    };
  });
}

test('N1 attendance states render in the real class page without a live backend', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  await expect(page.getByRole('heading', { name: '合成班' })).toBeVisible();
  await expect(row(page, 'SYN-N1-A')).toContainText('L: 出席');
  await expect(row(page, 'SYN-N1-A')).toContainText('R: 出席');
  await expect(row(page, 'SYN-N1-A')).toContainText('S: 出席');
  await expect(row(page, 'SYN-N1-A')).toContainText('W: 出席');
  await expect(row(page, 'SYN-N1-B')).toContainText('L: 缺席');
  await expect(row(page, 'SYN-N1-B')).not.toContainText('未確認');
  await expect(row(page, 'SYN-N1-C')).toContainText('L: 未確認');
  await expect(row(page, 'SYN-N1-C')).not.toContainText('缺席');
  await expect(row(page, 'SYN-N1-D')).toContainText('W: 未確認');
  await expect(row(page, 'SYN-N1-D')).not.toContainText('缺席');
  await expect(row(page, 'SYN-N1-E')).toContainText('未匯入');
  await expect(row(page, 'SYN-N1-E')).not.toContainText('缺席');
  await expect(row(page, 'SYN-N1-F')).toContainText('聽讀說寫');
  await expect(row(page, 'SYN-N1-F')).toContainText('未匯入');
  await expect(row(page, 'SYN-N1-F')).not.toContainText('出席');
  await expect(row(page, 'SYN-N1-G')).toContainText('未報名');
  await expect(row(page, 'SYN-N1-G')).toContainText('未匯入');
  await expect(row(page, 'SYN-N1-G')).not.toContainText('缺席');
  await expect(row(page, 'SYN-N1-H')).toContainText('總分: 0');
  await expect(row(page, 'SYN-N1-H')).not.toContainText('總分: -');

  const labels = ['出席', '缺席', '未確認', '未匯入'];
  for (const label of labels) {
    const badge = page.locator('.badge', { hasText: label }).first();
    await expect(badge).toBeVisible();
    const measured = await contrastRatio(badge);
    expect(measured.ratio).not.toBeNull();
    expect(measured.ratio).toBeGreaterThanOrEqual(4.5);
    console.log(`contrast ${label} ${measured.ratio.toFixed(2)}`);
  }

  await page.getByPlaceholder('輸入學號或姓名...').focus();
  await page.keyboard.press('Tab');
  await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName || '')).not.toBe('BODY');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByPlaceholder('輸入學號或姓名...')).toBeFocused();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.getByRole('columnheader', { name: '出席狀況' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('columnheader', { name: '出席狀況' })).toBeVisible();
    await expect(row(page, 'SYN-N1-C').locator('.badge', { hasText: '未確認' }).first()).toBeVisible();
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const table = document.querySelector('.table-responsive');
      const badge = document.querySelector('.badge');
      const before = root.scrollWidth;
      let scrolled = false;
      if (table && table.scrollWidth > table.clientWidth) {
        table.scrollLeft = table.scrollWidth;
        scrolled = table.scrollLeft > 0;
      }
      return {
        pageOverflow: root.scrollWidth - root.clientWidth,
        pageGrew: root.scrollWidth - before,
        overflowX: table ? getComputedStyle(table).overflowX : '',
        tableClient: table ? table.clientWidth : 0,
        tableScroll: table ? table.scrollWidth : 0,
        scrolled,
        badgeOverflow: badge ? badge.scrollWidth - badge.clientWidth : 0,
      };
    });
    expect(layout.pageOverflow).toBeLessThanOrEqual(1);
    expect(layout.pageGrew).toBe(0);
    expect(['auto', 'scroll']).toContain(layout.overflowX);
    expect(layout.badgeOverflow).toBeLessThanOrEqual(1);
    if (layout.tableScroll > layout.tableClient) {
      expect(layout.scrolled).toBe(true);
    }
    test.info().annotations.push({
      type: viewport.name,
      description: JSON.stringify(layout),
    });
    console.log(`viewport ${viewport.name} ${JSON.stringify(layout)}`);
  }

  expect(state.calls.length).toBeGreaterThan(0);
  expect(state.calls.every((call) => call.path === OVERVIEW_PATH && call.method === 'GET')).toBe(true);
  expect(state.calls.every((call) => call.authorization === `Bearer ${HARNESS_TOKEN}`)).toBe(true);
  expect(state.calls.every((call) => !call.authorization.includes('eyJ'))).toBe(true);
  expect(state.blocked).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
  await expect(page.locator('body')).not.toContainText('@');
  expect(state.calls.some((call) => call.path.includes('/export'))).toBe(false);
});

test('N1 pagination search and exam filter stay on the real controls', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  await expect(page.getByRole('button', { name: '下一頁' })).toBeVisible();
  await page.getByRole('button', { name: '下一頁' }).click();
  await expect(page.getByText('SYN-N1-P2')).toBeVisible();
  await expect(page.getByText('SYN-N1-A')).toHaveCount(0);
  await expect(row(page, 'SYN-N1-P2')).toContainText('L: 出席');

  await page.getByRole('button', { name: '上一頁' }).click();
  await expect(page.getByText('SYN-N1-A')).toBeVisible();
  await page.locator('label:text-is("考試類型") + select').selectOption('LR');
  await expect.poll(() => state.calls.some((call) => call.examType === 'LR' && call.page === '1')).toBe(true);
  await page.getByPlaceholder('輸入學號或姓名...').fill('SYN-N1-H');
  await expect.poll(() => state.calls.some((call) => call.search === 'SYN-N1-H')).toBe(true);
  await expect(page.getByText('SYN-N1-H')).toBeVisible();
  await expect(page.getByText('SYN-N1-B')).toHaveCount(0);
  await expect(row(page, 'SYN-N1-H')).toContainText('總分: 0');
  expect(state.blocked).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('N1 empty state does not invent attendance', async ({ page }) => {
  const state = await openHarness(page, 'empty');
  await expect(page.getByText('沒有找到符合條件的資料')).toBeVisible();
  await expect(page.getByText('缺席')).toHaveCount(0);
  expect(state.blocked).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('N1 loading state resolves only after the synthetic response', async ({ page }) => {
  const state = await openHarness(page, 'loading');
  await expect(page.getByText('載入中...')).toBeVisible();
  expect(state.calls.length).toBeGreaterThan(0);
  state.release();
  await expect(page.getByText('SYN-N1-A')).toBeVisible();
  expect(state.blocked).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('N1 error state does not render a student table', async ({ page }) => {
  const state = await openHarness(page, 'error');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('SYN-N1-A')).toHaveCount(0);
  await expect(page.getByText('缺席')).toHaveCount(0);
  expect(state.blocked).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.calls.every((call) => call.path === OVERVIEW_PATH)).toBe(true);
});
