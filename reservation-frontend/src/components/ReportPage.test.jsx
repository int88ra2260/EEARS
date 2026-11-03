import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ReportPage from './ReportPage';
import { fetchClient } from '../utils/fetchClient';

const outlet = { token: 'test-token', accessProfile: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => outlet,
  };
});

vi.mock('../utils/fetchClient', () => ({
  fetchClient: vi.fn(),
}));

vi.mock('../utils/errorHandler', () => ({
  handleAPIError: () => ({ display: '下載失敗' }),
  showSuccessMessage: vi.fn(),
}));

function renderPage() {
  return render(<ReportPage />);
}

describe('ReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    outlet.accessProfile = null;
    fetchClient.mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['workbook']),
      headers: {
        get: (name) => (String(name).toLowerCase() === 'content-disposition'
          ? 'attachment; filename="EEARS_114-1.xlsx"'
          : null),
      },
    });
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = () => 'blob:synthetic';
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = () => {};
    }
  });

  test('keeps workbook scope behind the details and offers a download on each card', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('heading', { name: '活動營運總覽工作簿' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '高關注名單工作簿' })).toBeInTheDocument();
    expect(screen.getByText(/報表摘要、活動預約營運、班級行政追蹤/).closest('details')).toBeTruthy();
    expect(screen.queryByText('class_memberships')).toBeNull();
    expect(screen.queryByText('下載目前結果')).toBeNull();
    expect(screen.getAllByRole('button', { name: /下載這份 Excel/ })).toHaveLength(2);
    await user.click(screen.getAllByText('查看資料範圍與口徑')[0]);
    expect(screen.getByText(/報表摘要、活動預約營運、班級行政追蹤/)).toBeVisible();
    expect(screen.getByText(/簽到出席率（預約）/)).toBeInTheDocument();
    expect(screen.getByText(/不是活動營運總覽畫面的逐列存檔/)).toBeInTheDocument();
  });

  test('downloads each workbook with its own semester and xlsx request', async () => {
    const user = userEvent.setup();
    renderPage();
    const overview = screen.getByRole('heading', { name: '活動營運總覽工作簿' }).closest('article');
    const risk = screen.getByRole('heading', { name: '高關注名單工作簿' }).closest('article');
    await user.click(within(overview).getByRole('button', { name: /下載這份 Excel/ }));
    await waitFor(() => expect(fetchClient).toHaveBeenCalledTimes(1));
    expect(fetchClient.mock.calls[0][0]).toBe('/api/reports/overview?semester=114-1&format=xlsx');
    await user.selectOptions(screen.getByLabelText('學期'), '115-1');
    await user.click(within(risk).getByRole('button', { name: /下載這份 Excel/ }));
    await waitFor(() => expect(fetchClient).toHaveBeenCalledTimes(2));
    expect(fetchClient.mock.calls[1][0]).toBe('/api/reports/high-risk?semester=115-1&format=xlsx');
  });

  test('hides the download when the profile cannot export reports', () => {
    outlet.accessProfile = { permissionSet: new Set() };
    renderPage();
    expect(screen.getByText('這個帳號沒有報表下載權限，無法取得工作簿。')).toBeInTheDocument();
    expect(screen.getByTestId('report-download-overview')).toBeDisabled();
    expect(screen.getByTestId('report-download-high-risk')).toBeDisabled();
  });
});
