import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const HARNESS = '/browser-tests/index.html';
const ALLOWED_API = new Set([
  '/api/analytics/overview',
  '/api/analytics/reservation-capacity-breakdown',
  '/api/analytics/trends',
  '/api/analytics/events',
  '/api/analytics/classes',
]);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'small-mobile', width: 375, height: 667 },
];
const NOTE_LABELS = [
  '活動總名額說明',
  '預約筆數說明',
  '預約名額比說明',
  '預約列簽到率說明',
  '預約列違規狀態比說明',
];

function rankings(prefix) {
  return Array.from({ length: 10 }, (_, index) => ({
    classId: `${prefix}-${index + 1}`,
    className: `班${String(index + 1).padStart(2, '0')}`,
    violationRate: 10 - index,
    attendanceRate: 80,
    reservationsCount: 4,
  }));
}

function overviewBody(semester, mode) {
  if (mode === 'zero') {
    return {
      semester,
      totalReservations: 0,
      totalEventCapacity: 0,
      bookingRate: 0,
      attendanceRate: 0,
      violationRate: 0,
      englishPassRate: 0,
    };
  }
  if (mode === 'null') return { semester };
  if (mode === 'inconsistent') {
    return {
      semester,
      totalReservations: 1,
      totalEventCapacity: 100,
      bookingRate: 33.33,
      attendanceRate: 50,
      violationRate: 1,
      englishPassRate: 2,
    };
  }
  if (semester === '114-1') {
    return {
      semester,
      totalReservations: 7,
      totalEventCapacity: 40,
      bookingRate: 17.5,
      attendanceRate: 40,
      violationRate: 1,
      englishPassRate: 4,
    };
  }
  return {
    semester,
    totalReservations: 48,
    totalEventCapacity: 80,
    bookingRate: 60,
    attendanceRate: 75,
    violationRate: 2.5,
    englishPassRate: 11,
  };
}

function payloadFor(pathname, semester, mode) {
  const emptyCharts = mode === 'zero' || mode === 'null';
  const eventName = semester === '114-1' ? '週二桌' : '週一桌';
  const reserved = semester === '114-1' ? 7 : 6;
  if (pathname === '/api/analytics/overview') return overviewBody(semester, mode);
  if (pathname === '/api/analytics/reservation-capacity-breakdown') {
    if (emptyCharts) {
      return { semester, items: [], byEvent: [], summary: { synthetic: true } };
    }
    return {
      semester,
      items: [{
        eventType: 'English Table',
        totalEventCapacity: semester === '114-1' ? 40 : 80,
        totalReservations: semester === '114-1' ? 7 : 48,
        bookingRate: semester === '114-1' ? 17.5 : 60,
      }],
      byEvent: [{
        eventId: semester === '114-1' ? 'event-b' : 'event-a',
        eventDate: '2026-03-02',
        eventName,
        eventType: 'English Table',
        maxCapacity: 20,
        totalReservations: reserved,
        bookingRate: 30,
      }],
      summary: { synthetic: true },
    };
  }
  if (pathname === '/api/analytics/trends') {
    return {
      activityTrend: emptyCharts ? [] : [
        { date: '2026-03-02', reservationsCount: semester === '114-1' ? 2 : 5 },
        { date: '2026-03-09', reservationsCount: 3 },
      ],
    };
  }
  if (pathname === '/api/analytics/events') {
    return {
      attendanceTrend: emptyCharts ? [] : [
        { date: '2026-03-02', attendanceRate: 75 },
        { date: '2026-03-09', attendanceRate: 50 },
      ],
    };
  }
  return { rankings: emptyCharts ? [] : rankings(semester) };
}

async function installIsolation(page, mode) {
  const state = {
    mode,
    hold: false,
    release: null,
    calls: [],
    blocked: [],
    consoleErrors: [],
    pageErrors: [],
    sizeWarnings: [],
  };

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') state.consoleErrors.push(text);
    if (/width\(-1\)|Infinity|NaN/.test(text)) state.sizeWarnings.push(text);
  });
  page.on('pageerror', (error) => {
    state.pageErrors.push(String(error));
  });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    if (!local || (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/analytics/'))) {
      state.blocked.push(url.href);
      await route.abort();
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/analytics/**', async (route) => {
    const url = new URL(route.request().url());
    const record = {
      path: url.pathname,
      semester: url.searchParams.get('semester'),
      kind: url.searchParams.get('kind'),
      authorization: route.request().headers().authorization || '',
    };
    state.calls.push(record);
    if (!ALLOWED_API.has(url.pathname)) {
      state.blocked.push(url.href);
      await route.fulfill({ status: 599, body: 'unexpected analytics path' });
      return;
    }
    if (state.hold && url.pathname === '/api/analytics/overview') {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 8000);
        state.release = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
    if (state.mode === 'error' && url.pathname === '/api/analytics/overview') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: '總覽載入失敗' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payloadFor(url.pathname, record.semester, state.mode)),
    });
  });

  return state;
}

async function openHarness(page, mode) {
  const state = await installIsolation(page, mode);
  await page.goto(HARNESS);
  await expect(page).toHaveURL(/127\.0\.0\.1:3017\/browser-tests\/index\.html/);
  await expect(page.getByText('活動營運總覽')).toBeVisible();
  return state;
}

async function waitForCharts(page) {
  await expect.poll(async () => page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => {
    const box = await page.locator('.recharts-wrapper').first().boundingBox();
    return box?.width ?? 0;
  }).toBeGreaterThan(40);
}

function reservationText(semester, mode) {
  if (mode === 'zero') return '0';
  if (mode === 'null') return '—';
  if (mode === 'inconsistent') return '1';
  return semester === '114-1' ? '7' : '48';
}

test('H01 H06 H07 H08 H09 H17 H18 H19 H20 normal fixture, charts, and isolation', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  const semester = await page.getByLabel('學期').inputValue();
  await expect(page.getByTestId('ops-value-reservations')).toHaveText(reservationText(semester, 'normal'));
  await expect(page.getByTestId('ops-value-capacity')).toHaveText(semester === '114-1' ? '40' : '80');
  await expect(page.getByTestId('ops-value-booking')).toHaveText(semester === '114-1' ? '17.5%' : '60.0%');
  await expect(page.getByTestId('ops-context')).toContainText(semester);
  await expect(page.getByTestId('ops-context')).toContainText('全中心活動，以活動日期篩選。');
  await expect(page.getByRole('button', { name: '報名資料補充資訊' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('ops-core-kpis').getByText('報名資料 B2 標記比例')).toHaveCount(0);

  await page.getByLabel('學期').selectOption('114-2');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('48');
  await expect(page.getByTestId('ops-context')).toContainText('2026/02/01–2026/07/31');

  await waitForCharts(page);
  await expect(page.getByRole('heading', { name: '活動趨勢（依活動日期）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '預約列簽到率（依活動日期）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '班級排行（Top 10，依預約列違規狀態比）' })).toBeVisible();
  await expect(page.locator('.recharts-cartesian-axis-tick').filter({ hasText: '03/02' }).first()).toBeVisible();
  await expect(page.locator('.recharts-cartesian-axis-tick').filter({ hasText: '班01' }).first()).toBeVisible();

  const surfaces = await page.locator('.recharts-surface').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      viewBox: node.getAttribute('viewBox'),
    };
  }));
  expect(surfaces.length).toBeGreaterThanOrEqual(3);
  for (const surface of surfaces) {
    expect(surface.width).toBeGreaterThan(40);
    expect(surface.height).toBeGreaterThan(40);
    expect(surface.viewBox || '').not.toMatch(/-/);
  }

  await expect(page.getByTestId('capacity-by-type')).toContainText('English Table');
  await expect(page.getByTestId('capacity-by-type')).toContainText('活動類型');
  await expect(page.getByTestId('capacity-by-event')).toContainText('週一桌');
  await expect(page.getByTestId('capacity-by-event')).toContainText('活動名稱');

  const bar = page.locator('.recharts-bar-rectangle').first();
  await bar.hover();
  await expect(page.locator('.recharts-tooltip-wrapper').last()).toBeVisible();

  expect(state.calls.some((call) => call.path === '/api/analytics/overview' && call.kind === 'reservation')).toBe(true);
  expect(state.calls.some((call) => call.path === '/api/analytics/trends' && call.kind === 'reservation')).toBe(true);
  expect(state.calls.every((call) => ALLOWED_API.has(call.path))).toBe(true);
  expect(state.calls.every((call) => call.authorization === 'Bearer analytics-browser-harness')).toBe(true);
  expect(state.calls.every((call) => !call.authorization.includes('eyJ'))).toBe(true);
  expect(state.blocked).toEqual([]);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.sizeWarnings).toEqual([]);
  await expect(page.getByRole('heading', { name: /場次數|取消率|不重複學生/ })).toHaveCount(0);
  await expect(page.getByTestId('ops-value-event-count')).toHaveCount(0);
});

test('H02 zero fixture shows numeric zero', async ({ page }) => {
  const state = await openHarness(page, 'zero');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('0');
  await expect(page.getByTestId('ops-value-capacity')).toHaveText('0');
  await expect(page.getByTestId('ops-value-booking')).toHaveText('0.0%');
  await expect(page.getByTestId('ops-value-attendance')).toHaveText('0.0%');
  await expect(page.getByTestId('ops-value-violation')).toHaveText('0.0%');
  await expect(page.getByRole('alert').filter({ hasText: '皆為 0' })).toBeVisible();
  await expect(page.getByText('查無活動資料')).toBeVisible();
  await expect(page.getByText('尚無足夠資料產生圖表')).toBeVisible();
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('H03 null and missing fields do not become zero or NaN', async ({ page }) => {
  const state = await openHarness(page, 'null');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('—');
  await expect(page.getByTestId('ops-value-capacity')).toHaveText('—');
  await expect(page.getByTestId('ops-value-booking')).toHaveText('—');
  await expect(page.getByTestId('ops-value-attendance')).toHaveText('—');
  await expect(page.getByTestId('ops-value-violation')).toHaveText('—');
  await expect(page.getByText('0.0%')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('NaN');
  await expect(page.locator('body')).not.toContainText('Infinity');
  await expect(page.locator('body')).not.toContainText('undefined');
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
});

test('H04 H15 overview error does not render a fake zero', async ({ page }) => {
  const state = await openHarness(page, 'error');
  await expect(page.getByRole('alert').filter({ hasText: '總覽載入失敗' })).toBeVisible();
  await expect(page.getByTestId('ops-value-reservations')).toHaveCount(0);
  await expect(page.getByTestId('ops-value-booking')).toHaveCount(0);
  await expect(page.getByTestId('ops-core-kpis')).toHaveCount(0);
  await expect(page.getByText('0.0%')).toHaveCount(0);
  expect(state.pageErrors).toEqual([]);
  expect(state.consoleErrors.length).toBeGreaterThan(0);
  expect(state.consoleErrors.every((text) => text.includes('status of 500'))).toBe(true);
});

test('H05 inconsistent booking rate stays on the API value', async ({ page }) => {
  await openHarness(page, 'inconsistent');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('1');
  await expect(page.getByTestId('ops-value-capacity')).toHaveText('100');
  await expect(page.getByTestId('ops-value-booking')).toHaveText('33.3%');
  await expect(page.getByTestId('ops-value-booking')).not.toHaveText('1.0%');
});

test('H10 five viewports keep the page inside the viewport', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  await page.getByLabel('學期').selectOption('114-2');
  await waitForCharts(page);
  const evidenceDir = path.join(process.cwd(), 'browser-tests', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = [];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect.poll(async () => {
      const box = await page.locator('.recharts-wrapper').first().boundingBox();
      return Math.round(box?.width ?? 0);
    }).toBeGreaterThan(40);

    const measured = await page.evaluate(() => {
      const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const charts = [...document.querySelectorAll('.recharts-surface')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      const clipped = [...document.querySelectorAll('.eears-chart-card')].flatMap((card) => {
        const cardRect = card.getBoundingClientRect();
        return [...card.querySelectorAll('.recharts-cartesian-axis-tick text')]
          .filter((tick) => {
            const rect = tick.getBoundingClientRect();
            if (rect.width === 0) return false;
            return rect.bottom > cardRect.bottom + 2
              || rect.right > cardRect.right + 2
              || rect.left < cardRect.left - 2;
          })
          .map((tick) => tick.textContent);
      });
      const tables = [...document.querySelectorAll('.table-responsive')].map((node) => ({
        scrollable: node.scrollWidth - node.clientWidth,
      }));
      const parse = (color) => {
        const match = String(color).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/);
        if (!match) return null;
        return {
          rgb: [Number(match[1]), Number(match[2]), Number(match[3])],
          alpha: match[4] === undefined ? 1 : Number(match[4]),
        };
      };
      const composite = (foreground, background) => ([
        (foreground.rgb[0] * foreground.alpha) + (background.rgb[0] * (1 - foreground.alpha)),
        (foreground.rgb[1] * foreground.alpha) + (background.rgb[1] * (1 - foreground.alpha)),
        (foreground.rgb[2] * foreground.alpha) + (background.rgb[2] * (1 - foreground.alpha)),
      ]);
      const channel = (value) => {
        const scaled = value / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (rgb) => (0.2126 * channel(rgb[0])) + (0.7152 * channel(rgb[1])) + (0.0722 * channel(rgb[2]));
      const contrastRatio = (foreground, background) => {
        const light = Math.max(luminance(foreground), luminance(background));
        const dark = Math.min(luminance(foreground), luminance(background));
        return (light + 0.05) / (dark + 0.05);
      };
      const muted = document.querySelector('[data-testid="ops-context"] .text-muted');
      const value = document.querySelector('[data-testid="ops-value-capacity"]');
      const axis = document.querySelector('.recharts-cartesian-axis-tick text');
      const card = value?.closest('.card');
      const mutedRaw = muted ? getComputedStyle(muted).color : null;
      const valueRaw = value ? getComputedStyle(value).color : null;
      const axisRaw = axis ? getComputedStyle(axis).fill : null;
      const backgroundRaw = card ? getComputedStyle(card).backgroundColor : 'rgb(255, 255, 255)';
      const background = parse(backgroundRaw) || { rgb: [255, 255, 255], alpha: 1 };
      const ratioFor = (raw) => {
        const parsed = raw ? parse(raw) : null;
        if (!parsed) return null;
        return Number(contrastRatio(composite(parsed, background), background.rgb).toFixed(2));
      };
      return {
        pageOverflow,
        charts,
        clipped,
        tables,
        contrast: {
          muted: ratioFor(mutedRaw),
          value: ratioFor(valueRaw),
          axis: ratioFor(axisRaw),
        },
      };
    });
    report.push({ viewport: viewport.name, ...measured });
    await page.screenshot({
      path: path.join(evidenceDir, `${viewport.name}.png`),
      fullPage: true,
    });
    expect(measured.pageOverflow, viewport.name).toBeLessThanOrEqual(1);
    expect(measured.charts.length, viewport.name).toBeGreaterThanOrEqual(3);
    expect(measured.clipped, viewport.name).toEqual([]);
    for (const chart of measured.charts) {
      expect(chart.width, viewport.name).toBeGreaterThan(40);
      expect(chart.height, viewport.name).toBeGreaterThan(40);
    }
  }

  console.log(`BROWSER_METRICS ${JSON.stringify(report)}`);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.sizeWarnings).toEqual([]);
});

test('H11 H12 keyboard notes and registration supplement', async ({ page }) => {
  await openHarness(page, 'normal');
  await expect(page.getByTestId('ops-value-reservations')).toBeVisible();
  await page.getByLabel('學期').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '重新整理' })).toBeFocused();
  await page.keyboard.press('Tab');

  for (const label of NOTE_LABELS) {
    const button = page.getByRole('button', { name: label });
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const controls = await button.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    await expect(page.locator(`[id="${controls}"]`)).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toBeFocused();
    await expect(page.locator(`[id="${controls}"]`)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    await expect(page.locator(`[id="${controls}"]`)).toBeHidden();
    await page.keyboard.press('Tab');
  }

  const supplement = page.getByRole('button', { name: '報名資料補充資訊' });
  await supplement.focus();
  await expect(supplement).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter');
  await expect(supplement).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('報名資料 B2 標記比例')).toBeVisible();
  await expect(page.getByText('不能據此認定活動提升學生英語能力。')).toBeVisible();
  await expect(page.getByTestId('ops-core-kpis').getByText('報名資料 B2 標記比例')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(supplement).toHaveAttribute('aria-expanded', 'false');
  await expect(supplement).toBeFocused();
  await expect(page.getByText('報名資料 B2 標記比例')).toBeHidden();
});

test('H13 semester switch clears the previous KPI until the next payload arrives', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  const current = await page.getByLabel('學期').inputValue();
  await expect(page.getByTestId('ops-value-reservations')).toHaveText(reservationText(current, 'normal'));
  const next = current === '114-1' ? '114-2' : '114-1';
  state.hold = true;
  await page.getByLabel('學期').selectOption(next);
  await expect(page.getByRole('status')).toContainText('載入中');
  await expect(page.getByTestId('ops-value-reservations')).toHaveCount(0);
  await expect.poll(() => state.release !== null).toBe(true);
  state.release();
  await expect(page.getByTestId('ops-value-reservations')).toHaveText(reservationText(next, 'normal'));
  await expect(page.getByTestId('capacity-by-event')).toContainText(next === '114-1' ? '週二桌' : '週一桌');
  await expect(page.locator('.recharts-cartesian-axis-tick').filter({ hasText: '班01' })).toBeVisible();
  const overviewCalls = state.calls.filter((call) => call.path === '/api/analytics/overview');
  expect(overviewCalls.some((call) => call.semester === next)).toBe(true);
});

test('H14 refresh repeats the selected semester without summing', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  await page.getByLabel('學期').selectOption('114-2');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('48');
  const before = state.calls.filter((call) => (
    call.path === '/api/analytics/overview' && call.semester === '114-2'
  )).length;
  await page.getByRole('button', { name: '重新整理' }).click();
  await expect.poll(() => state.calls.filter((call) => (
    call.path === '/api/analytics/overview' && call.semester === '114-2'
  )).length).toBeGreaterThan(before);
  await expect(page.getByLabel('學期')).toHaveValue('114-2');
  await expect(page.getByTestId('ops-value-reservations')).toHaveText('48');
  await expect(page.getByTestId('ops-value-capacity')).toHaveText('80');
});

test('H16 console stays clean on the normal page', async ({ page }) => {
  const state = await openHarness(page, 'normal');
  await waitForCharts(page);
  expect(state.consoleErrors).toEqual([]);
  expect(state.pageErrors).toEqual([]);
  expect(state.sizeWarnings).toEqual([]);
});
