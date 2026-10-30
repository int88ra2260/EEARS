import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminAuditLogsPage from './AdminAuditLogsPage';

const api = vi.hoisted(() => ({
  fetchAuditLogs: vi.fn(),
  fetchAuditDetail: vi.fn(),
  fetchEmailLogs: vi.fn(),
  fetchLogMetricsSummary: vi.fn(),
  fetchLogsByRequestId: vi.fn(),
  fetchSystemLogs: vi.fn(),
}));

vi.mock('../../services/auditAdminApi', () => api);

const auditRow = {
  id: 9,
  module: 'auth',
  entityType: 'user',
  entityId: '9',
  action: 'login_failure',
  operatorId: 9,
  operatorRole: 'teacher',
  operatorName: '王小明',
  targetSummary: '登入失敗：密碼錯誤',
  requestId: 'abcd1234efgh5678ijkl',
  ipAddress: '10.0.0.8',
  status: 'failed',
  errorMessage: '密碼錯誤',
  createdAt: '2026-10-29T12:00:00.000Z',
};

const metrics = {
  requestCount24h: 120,
  fiveXxCount24h: 2,
  auditCount24h: 40,
  avgRequestDurationMs24h: 86.4,
  email: { success: 10, failed: 1, retry: 0 },
};

function renderPage(entry = '/admin/logs') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/admin" element={<Outlet context={{ token: 'test-token' }} />}>
          <Route path="logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('操作紀錄頁', () => {
  beforeEach(() => {
    api.fetchAuditLogs.mockResolvedValue({
      items: [auditRow],
      pagination: { page: 1, totalPages: 1, total: 1 },
    });
    api.fetchSystemLogs.mockResolvedValue({
      items: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    });
    api.fetchEmailLogs.mockResolvedValue({
      items: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    });
    api.fetchLogMetricsSummary.mockResolvedValue({ metrics });
    api.fetchAuditDetail.mockResolvedValue({
      beforeData: { locked: false },
      afterData: { locked: true },
      changedFields: ['locked'],
    });
    api.fetchLogsByRequestId.mockResolvedValue({
      requestId: 'req-abc',
      systemLogs: [{
        id: 1,
        method: 'GET',
        path: '/api/health',
        status: 200,
        durationMs: 12,
        createdAt: '2026-10-29T12:00:00.000Z',
      }],
      auditLogs: [],
      emailLogs: [],
    });
  });

  test('同一列同時顯示操作、對象、操作者與錯誤', async () => {
    renderPage();

    expect(await screen.findByText('王小明 · 老師 #9')).toBeInTheDocument();
    expect(screen.getByText('登入失敗：密碼錯誤')).toBeInTheDocument();
    expect(screen.getByText('密碼錯誤')).toBeInTheDocument();
    expect(screen.getByText('人員 #9 · 來自 10.0.0.8')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /網站被呼叫/ })).toHaveTextContent('120');
    expect(screen.getByText('86 毫秒')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^登入失敗$/ }));
    await waitFor(() => {
      expect(api.fetchAuditLogs).toHaveBeenCalledWith('test-token', expect.objectContaining({
        action: 'login_failure',
        actionMode: 'exact',
        page: 1,
      }));
    });
  });

  test('5xx 卡片與勾選都會改查伺服器錯誤', async () => {
    renderPage();
    await screen.findByText('王小明 · 老師 #9');

    fireEvent.click(screen.getByRole('button', { name: /伺服器出錯/ }));
    await waitFor(() => {
      expect(api.fetchSystemLogs).toHaveBeenCalledWith('test-token', expect.objectContaining({
        statusMin: 500,
        statusMax: 599,
      }));
    });

    fireEvent.click(screen.getByRole('tab', { name: '人員做了什麼' }));
    fireEvent.click(screen.getByRole('tab', { name: '網站怎麼被呼叫' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '只看伺服器出錯' }));
    fireEvent.click(screen.getByRole('button', { name: '查找' }));
    await waitFor(() => {
      expect(api.fetchSystemLogs).toHaveBeenLastCalledWith('test-token', expect.objectContaining({
        statusMin: 500,
        statusMax: 599,
      }));
    });
  });

  test('網址上的 requestId 會打開同一請求的時間序', async () => {
    renderPage('/admin/logs?requestId=req-abc');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('/api/health')).toBeInTheDocument();
    expect(screen.getByText('網站呼叫 1 · 人員操作 0 · 寄出的信 0')).toBeInTheDocument();
    expect(screen.getByText('這次沒有人員操作、寄出的信。')).toBeInTheDocument();
  });
});
