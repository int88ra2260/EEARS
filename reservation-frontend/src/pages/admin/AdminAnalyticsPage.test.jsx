import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminAnalyticsPage from './AdminAnalyticsPage';
import {
  fetchAnalyticsClasses,
  fetchAnalyticsEvents,
  fetchAnalyticsOverview,
  fetchAnalyticsTrends,
  fetchReservationCapacityBreakdown,
} from '../../services/reportsAdminApi';
import { SEMESTER_RANGES } from '../../utils/semesterUtils';
import { formatActivityDateWindow, formatPct1 } from './activityOpsPresentation';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ token: 'test-token' }),
  };
});

vi.mock('../../utils/semesterUtils', async () => {
  const actual = await vi.importActual('../../utils/semesterUtils');
  return {
    ...actual,
    getCurrentSemester: () => '114-2',
  };
});

vi.mock('../../services/reportsAdminApi', () => ({
  fetchAnalyticsOverview: vi.fn(),
  fetchReservationCapacityBreakdown: vi.fn(),
  fetchAnalyticsTrends: vi.fn(),
  fetchAnalyticsEvents: vi.fn(),
  fetchAnalyticsClasses: vi.fn(),
  parseApiError: (_res, json) => json?.error || '載入失敗',
}));

vi.mock('recharts', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    Line: Empty,
    BarChart: Pass,
    Bar: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Tooltip: Empty,
    Cell: Empty,
    CartesianGrid: Empty,
  };
});

function overview(overrides = {}) {
  return {
    semester: '114-2',
    totalReservations: 10,
    totalEventCapacity: 40,
    bookingRate: 25,
    attendanceRate: 50,
    violationRate: 5,
    englishPassRate: 12.5,
    ...overrides,
  };
}

function breakdown() {
  return {
    res: { ok: true, status: 200 },
    json: {
      semester: '114-2',
      items: [{ eventType: 'English Table', reservedCount: 10, capacity: 40, utilizationRate: 25 }],
      byEventType: [{ eventType: 'English Table', totalReservations: 10, totalEventCapacity: 40, bookingRate: 25 }],
      byEvent: [{
        eventId: 9,
        eventDate: '2026-03-02',
        eventName: '週一桌',
        eventType: 'English Table',
        maxCapacity: 40,
        totalReservations: 10,
        bookingRate: 25,
      }],
      summary: { totalReservations: 10, totalEventCapacity: 40, bookingRate: 25 },
    },
  };
}

function mockHappyPath(overviewBody = overview()) {
  fetchAnalyticsOverview.mockResolvedValue(overviewBody);
  fetchReservationCapacityBreakdown.mockResolvedValue(breakdown());
  fetchAnalyticsTrends.mockResolvedValue({
    activityTrend: [{ date: '2026-03-02', reservationsCount: 3 }],
  });
  fetchAnalyticsEvents.mockResolvedValue({
    attendanceTrend: [{ date: '2026-03-02', attendanceRate: 50 }],
  });
  fetchAnalyticsClasses.mockResolvedValue({
    rankings: [{ classId: 1, className: 'A班', violationRate: 5, attendanceRate: 50, reservationsCount: 2 }],
  });
}

function renderPage() {
  return render(<AdminAnalyticsPage />);
}

describe('AdminAnalyticsPage operational overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHappyPath();
  });

  test('U01–U05 U08 U21 show API values, semester, and unchanged request params', async () => {
    renderPage();
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('10');
    expect(screen.getByTestId('ops-value-booking')).toHaveTextContent('25.0%');
    expect(screen.getByTestId('ops-value-attendance')).toHaveTextContent('50.0%');
    expect(screen.getByTestId('ops-value-capacity')).toHaveTextContent('40');
    expect(screen.getByTestId('ops-value-violation')).toHaveTextContent('5.0%');
    expect(screen.getByTestId('ops-context')).toHaveTextContent('114-2');
    expect(screen.getByLabelText('學期')).toHaveValue('114-2');

    expect(fetchAnalyticsOverview).toHaveBeenCalledWith('test-token', '114-2', { kind: 'reservation' });
    expect(fetchReservationCapacityBreakdown).toHaveBeenCalledWith('test-token', '114-2');
    expect(fetchAnalyticsTrends).toHaveBeenCalledWith('test-token', '114-2', 'reservation');
    expect(fetchAnalyticsEvents).toHaveBeenCalledWith('test-token', '114-2');
    expect(fetchAnalyticsClasses).toHaveBeenCalledWith('test-token', '114-2');
  });

  test('U06 U07 keep the registration B2 flag out of core KPIs and inside the supplement', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('ops-core-kpis');
    expect(within(screen.getByTestId('ops-core-kpis')).queryByText('報名資料 B2 標記比例')).toBeNull();
    const supplement = screen.getByTestId('ops-registration-supplement');
    const toggle = within(supplement).getByRole('button', { name: '報名資料補充資訊' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(supplement).getByText('報名資料 B2 標記比例')).not.toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(supplement).getByText('報名資料 B2 標記比例')).toBeVisible();
    expect(within(supplement).getByTestId('ops-value-english')).toHaveTextContent('12.5%');
    expect(within(supplement).getByText(/沒有與活動預約做 JOIN/)).toBeInTheDocument();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(supplement).queryByText('報名資料 B2 標記比例')).not.toBeVisible();
  });

  test('U09 formats the activity window from shared semester config', async () => {
    renderPage();
    const context = await screen.findByTestId('ops-context');
    const range = SEMESTER_RANGES['114-2'];
    expect(formatActivityDateWindow('114-2')).toBe(
      `${range.start.replaceAll('-', '/')}–${range.end.replaceAll('-', '/')}`
    );
    expect(context).toHaveTextContent(formatActivityDateWindow('114-2'));
    expect(formatActivityDateWindow('missing-semester', {})).toBeNull();

    const pageSource = fs.readFileSync(path.resolve('src/pages/admin/AdminAnalyticsPage.jsx'), 'utf8');
    const copySource = fs.readFileSync(path.resolve('src/pages/admin/activityOpsPresentation.js'), 'utf8');
    expect(pageSource).not.toMatch(/2026\/02\/01/);
    expect(pageSource).not.toMatch(/2026-02-01/);
    expect(copySource).not.toMatch(/2026\/02\/01/);
    expect(copySource).not.toMatch(/2026-02-01/);
  });

  test('U10 reloads when the semester changes', async () => {
    renderPage();
    await screen.findByTestId('ops-value-reservations');
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '114-1' } });
    await waitFor(() => {
      expect(fetchAnalyticsOverview).toHaveBeenCalledWith('test-token', '114-1', { kind: 'reservation' });
    });
    expect(fetchAnalyticsTrends).toHaveBeenCalledWith('test-token', '114-1', 'reservation');
  });

  test('U11 does not keep the previous semester numbers while the next request is loading', async () => {
    const overviewPending = [];
    const breakdownPending = [];
    const trendsPending = [];
    const eventsPending = [];
    const classesPending = [];
    fetchAnalyticsOverview.mockImplementation(
      () => new Promise((resolve) => overviewPending.push(resolve))
    );
    fetchReservationCapacityBreakdown.mockImplementation(
      () => new Promise((resolve) => breakdownPending.push(resolve))
    );
    fetchAnalyticsTrends.mockImplementation(
      () => new Promise((resolve) => trendsPending.push(resolve))
    );
    fetchAnalyticsEvents.mockImplementation(
      () => new Promise((resolve) => eventsPending.push(resolve))
    );
    fetchAnalyticsClasses.mockImplementation(
      () => new Promise((resolve) => classesPending.push(resolve))
    );

    renderPage();
    await waitFor(() => {
      expect(overviewPending).toHaveLength(1);
      expect(breakdownPending).toHaveLength(1);
      expect(trendsPending).toHaveLength(1);
      expect(eventsPending).toHaveLength(1);
      expect(classesPending).toHaveLength(1);
    });

    await act(async () => {
      breakdownPending[0](breakdown());
      trendsPending[0]({ activityTrend: [{ date: '2026-03-02', reservationsCount: 3 }] });
      eventsPending[0]({ attendanceTrend: [{ date: '2026-03-02', attendanceRate: 50 }] });
      classesPending[0]({
        rankings: [{ classId: 1, className: 'A班', violationRate: 5, attendanceRate: 50, reservationsCount: 2 }],
      });
      overviewPending[0](overview({ totalReservations: 777 }));
    });
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('777');

    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '114-1' } });
    await waitFor(() => expect(overviewPending).toHaveLength(2));
    expect(screen.queryByText('777')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('載入中');
    expect(screen.getByTestId('ops-context')).toHaveTextContent('114-1');
    expect(screen.queryByTestId('ops-value-reservations')).toBeNull();

    await act(async () => {
      breakdownPending[1](breakdown());
      trendsPending[1]({ activityTrend: [] });
      eventsPending[1]({ attendanceTrend: [] });
      classesPending[1]({ rankings: [] });
      overviewPending[1](overview({ totalReservations: 4 }));
    });
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('4');
    expect(screen.queryByText('777')).toBeNull();
  });

  test('U12 shows an API error instead of zero KPIs', async () => {
    fetchAnalyticsOverview.mockRejectedValue(new Error('總覽載入失敗'));
    fetchAnalyticsTrends.mockResolvedValue({ activityTrend: [] });
    fetchAnalyticsEvents.mockResolvedValue({ attendanceTrend: [] });
    fetchAnalyticsClasses.mockResolvedValue({ rankings: [] });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('總覽載入失敗');
    expect(screen.queryByTestId('ops-value-reservations')).toBeNull();
    expect(screen.queryByText('0.0%')).toBeNull();
    expect(screen.queryByTestId('ops-value-english')).toBeNull();
  });

  test('U13 renders null differently from a real zero', async () => {
    mockHappyPath(overview({
      totalReservations: null,
      totalEventCapacity: null,
      bookingRate: 0,
      attendanceRate: null,
      violationRate: 0,
      englishPassRate: null,
    }));
    renderPage();
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('—');
    expect(screen.getByTestId('ops-value-capacity')).toHaveTextContent('—');
    expect(screen.getByTestId('ops-value-attendance')).toHaveTextContent('—');
    expect(screen.getByTestId('ops-value-booking')).toHaveTextContent('0.0%');
    expect(screen.getByTestId('ops-value-violation')).toHaveTextContent('0.0%');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '報名資料補充資訊' }));
    expect(screen.getByTestId('ops-value-english')).toHaveTextContent('—');
    expect(screen.queryByText(/皆為 0/)).toBeNull();
  });

  test('U14 does not add items and byEventType into a second total', async () => {
    renderPage();
    await screen.findByTestId('ops-value-reservations');
    const typeTable = screen.getByTestId('capacity-by-type');
    expect(within(typeTable).getAllByRole('row')).toHaveLength(2);
    expect(within(typeTable).getAllByText('10')).toHaveLength(1);
    expect(screen.getByTestId('ops-value-reservations')).toHaveTextContent('10');
    expect(screen.queryByText('20')).toBeNull();
  });

  test('U15 U16 U17 keep charts, tables, and the semester filter', async () => {
    renderPage();
    await screen.findByTestId('capacity-by-type');
    expect(screen.getByTestId('capacity-by-event')).toHaveTextContent('週一桌');
    expect(screen.getByRole('heading', { name: '活動趨勢（依活動日期）' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '預約列簽到率（依活動日期）' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '班級排行（Top 10，依預約列違規狀態比）' })).toBeInTheDocument();
    const semesterFilter = screen.getByLabelText('學期');
    expect(semesterFilter).toBeEnabled();
    expect(within(semesterFilter).getByRole('option', { name: '114-1學期' })).toBeInTheDocument();
  });

  test('U18 does not invent an export on this page', async () => {
    renderPage();
    await screen.findByTestId('ops-value-reservations');
    expect(screen.queryByRole('button', { name: /匯出|下載/ })).toBeNull();
    expect(screen.getByRole('button', { name: '重新整理' })).toBeInTheDocument();
  });

  test('U19 metric notes open from click, Enter, and Space without trapping focus', async () => {
    const user = userEvent.setup();
    renderPage();
    const semester = await screen.findByLabelText('學期');
    semester.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: '重新整理' })).toHaveFocus();
    await user.tab();
    const capacityNote = screen.getByRole('button', { name: '活動總名額說明' });
    expect(capacityNote).toHaveFocus();
    expect(capacityNote).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{Enter}');
    expect(capacityNote).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(capacityNote.getAttribute('aria-controls'))).not.toHaveAttribute('hidden');
    expect(screen.getByText(/不是場次數/)).toBeVisible();

    await user.keyboard(' ');
    expect(capacityNote).toHaveAttribute('aria-expanded', 'false');
    expect(capacityNote).toHaveFocus();
    expect(screen.getByText(/不是場次數/)).not.toBeVisible();

    await user.tab();
    expect(screen.getByRole('button', { name: '預約筆數說明' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByText(/不是累計預約總次數/)).toBeInTheDocument();
  });

  test('U20 U22 U24 keep this page on reservation data and do not recompute or add metrics', async () => {
    mockHappyPath(overview({
      totalReservations: 1,
      totalEventCapacity: 100,
      bookingRate: 33.33,
    }));
    renderPage();
    expect(await screen.findByTestId('ops-value-booking')).toHaveTextContent('33.3%');
    expect(screen.getByTestId('ops-value-booking')).not.toHaveTextContent('1.0%');
    expect(formatPct1(33.33)).toBe('33.3%');
    expect(screen.queryByRole('heading', { name: /場次數|取消率|不重複學生/ })).toBeNull();
    expect(screen.queryByTestId('ops-value-event-count')).toBeNull();
    expect(screen.queryByLabelText('分析類型')).toBeNull();
    expect(fetchAnalyticsOverview.mock.calls.every((call) => call[2]?.kind === 'reservation')).toBe(true);
  });

  test('U23 uses full-width columns and a wrapping semester control', async () => {
    renderPage();
    await screen.findByTestId('ops-core-kpis');
    const cards = screen.getByTestId('ops-core-kpis').querySelectorAll('.col-12');
    expect(cards.length).toBeGreaterThan(0);
    const select = screen.getByLabelText('學期');
    expect(select.className).toContain('w-100');
    expect(select.parentElement.style.maxWidth).toBe('220px');
  });

  test('U25 leaves the overview route and access pattern in place', () => {
    const app = fs.readFileSync(path.resolve('src/App.js'), 'utf8');
    const access = fs.readFileSync(path.resolve('src/constants/adminRouteAccess.js'), 'utf8');
    expect(app).toMatch(/path="analytics\/overview"/);
    expect(access).toMatch(/pattern: '\/admin\/analytics\/overview'/);
  });

  test('refresh repeats the current semester request and restores the API value', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('ops-value-reservations');
    await user.click(screen.getByRole('button', { name: '重新整理' }));
    await waitFor(() => expect(fetchAnalyticsOverview).toHaveBeenCalledTimes(2));
    expect(fetchAnalyticsOverview).toHaveBeenLastCalledWith('test-token', '114-2', { kind: 'reservation' });
    expect(fetchAnalyticsTrends).toHaveBeenLastCalledWith('test-token', '114-2', 'reservation');
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('10');
  });

  test('all-zero payload stays zero and empty charts are described in text', async () => {
    mockHappyPath(overview({
      totalReservations: 0,
      totalEventCapacity: 0,
      bookingRate: 0,
      attendanceRate: 0,
      violationRate: 0,
      englishPassRate: 0,
    }));
    fetchAnalyticsTrends.mockResolvedValue({ activityTrend: [] });
    fetchAnalyticsEvents.mockResolvedValue({ attendanceTrend: [] });
    fetchAnalyticsClasses.mockResolvedValue({ rankings: [] });
    fetchReservationCapacityBreakdown.mockResolvedValue({
      res: { ok: true, status: 200 },
      json: { semester: '114-2', items: [], byEventType: [], byEvent: [], summary: null },
    });
    renderPage();
    expect(await screen.findByText(/皆為 0/)).toBeInTheDocument();
    expect(screen.getByTestId('ops-value-reservations')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('ops-value-booking')).toHaveTextContent('0.0%');
    expect(screen.getByText(/查無活動資料/)).toBeInTheDocument();
    expect(screen.getByText(/尚無足夠資料產生圖表/)).toBeInTheDocument();
  });

  test('breakdown tables keep a horizontal scroll container', async () => {
    renderPage();
    const typeTable = await screen.findByTestId('capacity-by-type');
    const eventTable = screen.getByTestId('capacity-by-event');
    expect(typeTable.querySelector('.table-responsive')).toBeTruthy();
    expect(eventTable.querySelector('.table-responsive')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '活動類型' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '活動名稱' })).toBeInTheDocument();
  });
});
