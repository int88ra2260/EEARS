import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    renderPage();
    await screen.findByTestId('ops-core-kpis');
    expect(within(screen.getByTestId('ops-core-kpis')).queryByText('報名資料 B2 標記比例')).toBeNull();
    const supplement = screen.getByTestId('ops-registration-supplement');
    expect(within(supplement).getByText('報名資料 B2 標記比例')).toBeInTheDocument();
    expect(within(supplement).getByTestId('ops-value-english')).toHaveTextContent('12.5%');
    expect(within(supplement).getByText(/沒有與活動預約做 JOIN/)).toBeInTheDocument();
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
    const pending = [];
    fetchAnalyticsOverview.mockImplementation(
      () => new Promise((resolve) => pending.push(resolve))
    );
    renderPage();
    await waitFor(() => expect(pending.length).toBe(1));
    await act(async () => {
      pending[0](overview({ totalReservations: 777 }));
    });
    expect(await screen.findByTestId('ops-value-reservations')).toHaveTextContent('777');

    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '114-1' } });
    expect(screen.queryByText('777')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('載入中');
    expect(screen.getByTestId('ops-context')).toHaveTextContent('114-1');
    expect(screen.queryByTestId('ops-value-reservations')).toBeNull();
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

  test('U19 metric notes are buttons that can take keyboard focus', async () => {
    renderPage();
    const noteButton = await screen.findByRole('button', { name: '預約筆數說明' });
    expect(noteButton.tagName).toBe('BUTTON');
    noteButton.focus();
    expect(noteButton).toHaveFocus();
    expect(noteButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(noteButton);
    expect(noteButton).toHaveAttribute('aria-expanded', 'true');
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
    expect(screen.queryByText(/場次數|不重複學生|取消率/)).toBeNull();
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
});
