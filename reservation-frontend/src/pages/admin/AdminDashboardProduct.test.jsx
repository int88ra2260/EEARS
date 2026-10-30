import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminDashboardProduct from './AdminDashboardProduct';
import { KPI_STATUS, useAdminDashboardProduct } from '../../hooks/useAdminDashboardProduct';

vi.mock('../../components/ui/useToast', () => ({
  default: () => ({}),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ token: 'staff-token', userRole: 'admin' }),
  };
});

vi.mock('../../hooks/useAdminDashboardProduct', () => ({
  KPI_STATUS: {
    LOADING: 'loading',
    SUCCESS: 'success',
    EMPTY: 'empty',
    ERROR: 'error',
  },
  useAdminDashboardProduct: vi.fn(),
}));

function kpi(status, value = 0, errorBrief = null) {
  return { status, value, errorBrief, requestId: status === KPI_STATUS.ERROR ? 'rid-1' : null };
}

function readyState(overrides = {}) {
  return {
    recentEvents: [],
    todayEventCount: 0,
    healthState: {
      status: KPI_STATUS.SUCCESS,
      health: {
        services: {
          db: { status: 'ok', latencyMs: 12 },
          email: { status: 'ok', latencyMs: 20 },
        },
      },
      requestId: null,
    },
    loadHealth: vi.fn(),
    kpiTodayReservations: kpi(KPI_STATUS.EMPTY, 0),
    kpiRecentEvents: kpi(KPI_STATUS.EMPTY, 0),
    kpiEnglishPending: kpi(KPI_STATUS.EMPTY, 0),
    kpiAnnouncementDraft: kpi(KPI_STATUS.EMPTY, 0),
    eventsSectionStatus: KPI_STATUS.EMPTY,
    violationsSectionStatus: KPI_STATUS.EMPTY,
    kpiAllEmpty: false,
    violations: [],
    recentViolations: [],
    handleCardRefresh: vi.fn(),
    fetchViolationsSection: vi.fn(),
    ...overrides,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AdminDashboardProduct />
    </MemoryRouter>
  );
}

describe('admin dashboard empty states', () => {
  beforeEach(() => {
    useAdminDashboardProduct.mockReset();
  });

  test('shows distinct empty copy when there is nothing pending, no events, and no violations', () => {
    useAdminDashboardProduct.mockReturnValue(readyState());
    renderDashboard();
    expect(screen.getByText('目前沒有待辦事項。')).toBeInTheDocument();
    expect(screen.getByText('尚未有活動')).toBeInTheDocument();
    expect(screen.getByText('這個學期目前沒有違規提醒。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往建立第一個活動' })).toHaveAttribute('href', '/admin/operations');
    expect(screen.queryByRole('link', { name: '前往處理' })).toBeNull();
  });

  test('shows event and violation content when data exists', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      recentEvents: [{ id: 7, name: 'English Table', date: '2026-10-30', startTime: '10:00', endTime: '11:00' }],
      todayEventCount: 1,
      eventsSectionStatus: KPI_STATUS.SUCCESS,
      kpiRecentEvents: kpi(KPI_STATUS.SUCCESS, 1),
      recentViolations: [{ id: 3, studentId: 'B123456789', studentName: '測試生', reason: '未到場' }],
      violations: [{ id: 3 }],
      violationsSectionStatus: KPI_STATUS.SUCCESS,
    }));
    renderDashboard();
    expect(screen.getByRole('link', { name: 'English Table' })).toBeInTheDocument();
    expect(screen.getByText('未到場')).toBeInTheDocument();
    expect(screen.getByText('今日場次 1 場')).toBeInTheDocument();
    expect(screen.queryByText('尚未有活動')).toBeNull();
    expect(screen.queryByText('這個學期目前沒有違規提醒。')).toBeNull();
    expect(screen.queryByText('目前沒有待辦事項。')).toBeNull();
  });

  test('keeps loading and error out of the empty states', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      eventsSectionStatus: KPI_STATUS.LOADING,
      violationsSectionStatus: KPI_STATUS.LOADING,
      kpiEnglishPending: kpi(KPI_STATUS.LOADING, null),
      kpiAnnouncementDraft: kpi(KPI_STATUS.LOADING, null),
    }));
    const loadingView = renderDashboard();
    expect(screen.queryByText('尚未有活動')).toBeNull();
    expect(screen.queryByText('目前沒有待辦事項。')).toBeNull();
    expect(screen.queryByText('這個學期目前沒有違規提醒。')).toBeNull();
    expect(screen.getAllByText('載入中').length).toBeGreaterThan(0);
    loadingView.unmount();

    useAdminDashboardProduct.mockReturnValue(readyState({
      eventsSectionStatus: KPI_STATUS.ERROR,
      kpiRecentEvents: kpi(KPI_STATUS.ERROR, null, '暫時無法取得'),
      violationsSectionStatus: KPI_STATUS.ERROR,
    }));
    renderDashboard();
    expect(screen.getByText('活動資料暫時無法取得。')).toBeInTheDocument();
    expect(screen.getByText('違規資料暫時無法取得。')).toBeInTheDocument();
    expect(screen.queryByText('尚未有活動')).toBeNull();
    expect(screen.queryByText('這個學期目前沒有違規提醒。')).toBeNull();
    expect(screen.queryByText('目前沒有待辦事項。')).toBeNull();
  });

  test('keeps known todos visible while another source is still loading', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      eventsSectionStatus: KPI_STATUS.LOADING,
      kpiEnglishPending: kpi(KPI_STATUS.SUCCESS, 2),
      violationsSectionStatus: KPI_STATUS.EMPTY,
    }));
    renderDashboard();
    expect(screen.getByText('英檢待審 2 筆')).toBeInTheDocument();
    expect(screen.queryByText('目前沒有待辦事項。')).toBeNull();
    expect(screen.queryByText('尚未有活動')).toBeNull();
  });

  test('does not call a still-loading source an empty todo list', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      eventsSectionStatus: KPI_STATUS.EMPTY,
      kpiEnglishPending: kpi(KPI_STATUS.LOADING, null),
      kpiAnnouncementDraft: kpi(KPI_STATUS.EMPTY, 0),
      violationsSectionStatus: KPI_STATUS.EMPTY,
    }));
    renderDashboard();
    expect(screen.getAllByText('載入中').length).toBeGreaterThan(0);
    expect(screen.queryByText('目前沒有待辦事項。')).toBeNull();
    expect(screen.getByText('尚未有活動')).toBeInTheDocument();
    expect(screen.getByText('這個學期目前沒有違規提醒。')).toBeInTheDocument();
  });

  test('a missing english-test permission stays a zero metric, not a section empty', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      recentEvents: [{ id: 7, name: 'English Table', date: '2026-10-30', startTime: '10:00', endTime: '11:00' }],
      eventsSectionStatus: KPI_STATUS.SUCCESS,
      kpiRecentEvents: kpi(KPI_STATUS.SUCCESS, 1),
      kpiEnglishPending: kpi(KPI_STATUS.EMPTY, 0),
    }));
    renderDashboard();
    expect(screen.getAllByText('目前沒有資料').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'English Table' })).toBeInTheDocument();
    expect(screen.queryByText('尚未有活動')).toBeNull();
  });

  test('a permission-style metric error stays on the metric card', () => {
    useAdminDashboardProduct.mockReturnValue(readyState({
      recentEvents: [{ id: 7, name: 'English Table', date: '2026-10-30', startTime: '10:00', endTime: '11:00' }],
      eventsSectionStatus: KPI_STATUS.SUCCESS,
      kpiRecentEvents: kpi(KPI_STATUS.SUCCESS, 1),
      kpiEnglishPending: kpi(KPI_STATUS.ERROR, null, '尚未登入'),
    }));
    renderDashboard();
    expect(screen.getByText('尚未登入')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'English Table' })).toBeInTheDocument();
    expect(screen.queryByText('尚未有活動')).toBeNull();
  });
});
