import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import RiskDetectionPage from './RiskDetectionPage';
import { fetchAnalyticsRisk } from '../services/reportsAdminApi';

const harness = vi.hoisted(() => ({ token: 'test-token' }));

function adminToken() {
  const body = btoa(JSON.stringify({ role: 'admin' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e.${body}.s`;
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ token: harness.token }),
  };
});

vi.mock('../utils/semesterUtils', async () => {
  const actual = await vi.importActual('../utils/semesterUtils');
  return {
    ...actual,
    getCurrentSemester: () => '114-2',
  };
});

vi.mock('../services/reportsAdminApi', () => ({
  fetchAnalyticsRisk: vi.fn(),
}));

const row = {
  studentId: 'B11000001',
  studentName: '合成學生',
  department: '外文系',
  className: 'ET-A',
  riskScore: 8,
  riskLevel: 'high',
  reasons: [{ key: 'noShow', label: '未到／缺席', value: 3, contribution: 4 }],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <RiskDetectionPage />
    </MemoryRouter>,
  );
}

describe('RiskDetectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.token = adminToken();
    fetchAnalyticsRisk.mockResolvedValue({ risks: [row] });
  });

  test('shows the class-roster high list and the existing learning-journey link', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: '班級名冊高關注名單' })).toBeInTheDocument();
    expect(screen.getByText('合成學生')).toBeInTheDocument();
    expect(screen.getByText(/側欄的「高關注名單」就是這一頁/)).toBeInTheDocument();
    expect(screen.getByText(/riskLevel 為 high/)).toBeInTheDocument();
    expect(screen.getByText(/未到／缺席，觀測值 3，既有加權 4/)).toBeInTheDocument();
    expect(screen.queryByText('中')).toBeNull();
    expect(screen.getByRole('link', { name: '合成學生' })).toHaveAttribute(
      'href',
      '/admin/analytics/student/B11000001?fromSemester=114-2&toSemester=114-2',
    );
    expect(fetchAnalyticsRisk).toHaveBeenCalledWith(adminToken(), '114-2');
  });

  test('a slower response for the previous semester does not replace the newer list', async () => {
    let releaseFirst;
    fetchAnalyticsRisk.mockImplementation((_token, semester) => {
      if (semester === '114-2') {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve({
        risks: [{ ...row, studentId: 'B11000002', studentName: '新學期學生' }],
      });
    });
    renderPage();
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: '114-1' } });
    expect(await screen.findByText('新學期學生')).toBeInTheDocument();
    releaseFirst({ risks: [{ ...row, studentName: '舊學期學生' }] });
    await waitFor(() => expect(fetchAnalyticsRisk).toHaveBeenCalledWith(adminToken(), '114-1'));
    expect(screen.queryByText('舊學期學生')).toBeNull();
    expect(screen.getByText('新學期學生')).toBeInTheDocument();
  });

  test('an empty high list is stated without inventing a clear status', async () => {
    fetchAnalyticsRisk.mockResolvedValue({ risks: [] });
    renderPage();
    expect(await screen.findByText(/沒有符合目前高關注條件的名單/)).toBeInTheDocument();
    expect(screen.queryByText(/所有學生都沒有風險/)).toBeNull();
  });

  test('does not link to the learning record when the account cannot open it', async () => {
    harness.token = 'test-token';
    renderPage();
    expect(await screen.findByText('合成學生')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '合成學生' })).toBeNull();
    expect(screen.getByText('這個帳號不能開啟這位學生的學習歷程。')).toBeInTheDocument();
  });

  test('null score stays distinct from zero', async () => {
    fetchAnalyticsRisk.mockResolvedValue({
      risks: [{ ...row, riskScore: null, reasons: [{ key: 'noShow', label: '未到／缺席', value: null, contribution: null }] }],
    });
    renderPage();
    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByText(/觀測值未提供/)).toBeInTheDocument();
    expect(screen.queryByText(/既有加權/)).toBeNull();
  });
});
