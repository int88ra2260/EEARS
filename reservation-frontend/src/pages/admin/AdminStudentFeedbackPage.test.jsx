import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminStudentFeedbackPage from './AdminStudentFeedbackPage';

const api = vi.hoisted(() => ({
  fetchAdminStudentFeedback: vi.fn(),
  fetchAdminStudentFeedbackDetail: vi.fn(),
  fetchAdminStudentFeedbackEvents: vi.fn(),
  fetchAdminStudentFeedbackSummary: vi.fn(),
  fetchFeedbackAssignees: vi.fn(),
  patchAdminStudentFeedback: vi.fn(),
  postAdminStudentFeedbackNote: vi.fn(),
  postAdminStudentFeedbackReply: vi.fn(),
}));

vi.mock('../../services/studentFeedbackApi', () => api);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const row = {
  id: 128,
  studentId: 'B123456789',
  studentName: '王小明',
  email: 'student@example.com',
  kindLabel: '問題回報',
  categoryLabel: '預約',
  message: '預約按鈕沒有反應',
  status: 'open',
  statusLabel: '待處理',
  assigneeName: '',
  emailStatus: 'sent',
  createdAt: '2026-11-08T06:00:00.000Z',
  updatedAt: '2026-11-09T01:00:00.000Z',
};

const summary = {
  total: 128,
  open: 24,
  inProgress: 13,
  closed: 91,
  unresolved: 37,
};

function renderPage({ canManage = false } = {}) {
  const accessProfile = {
    permissionSet: new Set(canManage ? ['can_manage_student_feedback'] : []),
  };
  return render(
    <MemoryRouter initialEntries={['/admin/student-feedback']}>
      <Routes>
        <Route path="/admin" element={<Outlet context={{ token: 'staff-token', accessProfile }} />}>
          <Route path="student-feedback" element={<AdminStudentFeedbackPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('學生回報後台', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [row], page: 1, pageSize: 20, total: 1 },
    });
    api.fetchAdminStudentFeedbackSummary.mockResolvedValue({ ok: true, data: summary });
    api.fetchAdminStudentFeedbackDetail.mockResolvedValue({ ok: true, data: { item: row } });
    api.fetchAdminStudentFeedbackEvents.mockResolvedValue({
      ok: true,
      data: { items: [], page: 1, pageSize: 50, total: 0 },
    });
    api.fetchFeedbackAssignees.mockResolvedValue({ ok: true, data: { items: [] } });
    api.patchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { notice: '已結案', item: { ...row, status: 'closed', statusLabel: '已結案' } },
    });
  });

  test('shows a loading state before the summary arrives', async () => {
    let finish;
    api.fetchAdminStudentFeedbackSummary.mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('統計載入中');
    finish({ ok: true, data: summary });
    expect(await screen.findByText('128')).toBeInTheDocument();
  });

  test('shows the whole-table counts after a successful summary', async () => {
    renderPage();
    expect(await screen.findByText('全部問題')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText(/未結案 37/)).toBeInTheDocument();
  });

  test('shows zeros when the summary is empty', async () => {
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [], page: 1, pageSize: 20, total: 0 },
    });
    api.fetchAdminStudentFeedbackSummary.mockResolvedValue({
      ok: true,
      data: { total: 0, open: 0, inProgress: 0, closed: 0, unresolved: 0 },
    });
    renderPage();
    expect(await screen.findByText(/未結案 0/)).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('目前沒有回報。')).toBeInTheDocument();
  });

  test('keeps the list when the summary fails', async () => {
    api.fetchAdminStudentFeedbackSummary.mockResolvedValue({
      ok: false,
      data: { message: '無法載入統計' },
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('無法載入統計');
    expect(screen.getByText('#128')).toBeInTheDocument();
    expect(screen.getByText('預約按鈕沒有反應')).toBeInTheDocument();
  });

  test('keeps the summary when the list fails', async () => {
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: false,
      data: { message: '無法載入學生回報' },
    });
    renderPage();
    expect(await screen.findByText('128')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('無法載入學生回報');
    expect(screen.queryByText('#128')).not.toBeInTheDocument();
  });

  test('shows the case id and the last update time', async () => {
    renderPage();
    expect(await screen.findByText('#128')).toBeInTheDocument();
    expect(screen.getByText('2026/11/09 09:00')).toBeInTheDocument();
  });

  test('asks the list for the selected sort', async () => {
    renderPage();
    await screen.findByText('#128');
    fireEvent.change(screen.getByLabelText('排序欄位'), { target: { value: 'updatedAt' } });
    fireEvent.change(screen.getByLabelText('排序方向'), { target: { value: 'asc' } });
    await waitFor(() => {
      expect(api.fetchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', expect.objectContaining({
        sortBy: 'updatedAt',
        sortOrder: 'asc',
        page: 1,
      }));
    });
  });

  test('shows public replies to a view-only account and keeps internal notes off the page', async () => {
    api.fetchAdminStudentFeedbackDetail.mockResolvedValue({
      ok: true,
      data: {
        item: {
          ...row,
          messages: [
            { id: 1, visibility: 'public', authorType: 'staff', body: '請改用另一個瀏覽器', createdAt: '2026-11-09T01:00:00.000Z' },
            { id: 2, visibility: 'internal', authorType: 'staff', body: '先內部確認原因', createdAt: '2026-11-09T02:00:00.000Z' },
          ],
        },
      },
    });
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('請改用另一個瀏覽器')).toBeInTheDocument();
    expect(screen.queryByText('先內部確認原因')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('內部備註')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('shows internal notes in their original order when the account can manage', async () => {
    api.fetchAdminStudentFeedbackDetail.mockResolvedValue({
      ok: true,
      data: {
        item: {
          ...row,
          messages: [
            { id: 1, visibility: 'public', authorType: 'staff', body: '請改用另一個瀏覽器', createdAt: '2026-11-09T01:00:00.000Z' },
            { id: 2, visibility: 'internal', authorType: 'staff', body: '先內部確認原因', createdAt: '2026-11-09T02:00:00.000Z' },
          ],
        },
      },
    });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    const publicReply = await screen.findByText('請改用另一個瀏覽器');
    const note = screen.getByText('先內部確認原因');
    expect(publicReply.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('reloads the summary after a successful status change', async () => {
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    await screen.findByRole('button', { name: '結案' });
    const callsBeforeClose = api.fetchAdminStudentFeedbackSummary.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '結案' }));
    await waitFor(() => {
      expect(api.patchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', 128, { status: 'closed' });
      expect(api.fetchAdminStudentFeedbackSummary.mock.calls.length).toBe(callsBeforeClose + 1);
    });
  });

  test('shows a status change with Taipei time and does not render hidden event fields', async () => {
    api.fetchAdminStudentFeedbackEvents.mockResolvedValue({
      ok: true,
      data: {
        items: [{
          id: 5,
          eventType: 'STATUS_CHANGED',
          actorType: 'staff',
          actorTeacherId: 9,
          beforeValue: { status: 'open', body: '機密備註正文' },
          afterValue: { status: 'in_progress' },
          createdAt: '2026-11-09T01:00:00.000Z',
          requestId: 'eyJhbGciOiJIUzI1NiJ9.payload.sig',
        }, {
          id: 8,
          eventType: 'STATUS_CHANGED',
          visibility: 'internal',
          beforeValue: { status: 'open', body: '未授權內部事件' },
          afterValue: { status: 'closed' },
          createdAt: '2026-11-09T03:00:00.000Z',
        }],
        page: 1,
        pageSize: 50,
        total: 2,
      },
    });
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('狀態變更')).toBeInTheDocument();
    expect(screen.getByText('操作者：教師 #9')).toBeInTheDocument();
    expect(screen.getByText('原始值：待處理')).toBeInTheDocument();
    expect(screen.getByText('新值：處理中')).toBeInTheDocument();
    expect(screen.getByText('操作時間：2026/11/09 09:00')).toBeInTheDocument();
    expect(screen.queryByText('機密備註正文')).not.toBeInTheDocument();
    expect(screen.queryByText('未授權內部事件')).not.toBeInTheDocument();
    expect(screen.queryByText(/eyJhbGciOiJIUzI1NiJ9/)).not.toBeInTheDocument();
    expect(screen.getAllByText('預約按鈕沒有反應').length).toBeGreaterThan(1);
  });

  test('shows an assignee change with the known name and an id when the name is missing', async () => {
    api.fetchFeedbackAssignees.mockResolvedValue({
      ok: true,
      data: { items: [{ id: 4, name: '林承辦', roleLabel: '行政' }] },
    });
    api.fetchAdminStudentFeedbackEvents.mockResolvedValue({
      ok: true,
      data: {
        items: [{
          id: 6,
          eventType: 'ASSIGNEE_CHANGED',
          actorType: 'staff',
          actorTeacherId: 8,
          beforeValue: { assignedTeacherId: null },
          afterValue: { assignedTeacherId: 4 },
          createdAt: '2026-11-09T02:00:00.000Z',
        }],
        page: 1,
        pageSize: 50,
        total: 1,
      },
    });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('承辦變更')).toBeInTheDocument();
    expect(screen.getByText('操作者：教師 #8')).toBeInTheDocument();
    expect(screen.getByText('原始值：尚未指派')).toBeInTheDocument();
    expect(screen.getByText('新值：林承辦')).toBeInTheDocument();
  });

  test('shows an empty timeline without blocking the case', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('尚無處理歷程')).toBeInTheDocument();
    expect(screen.getAllByText('預約按鈕沒有反應').length).toBeGreaterThan(1);
  });

  test('shows a timeline error without hiding the case', async () => {
    api.fetchAdminStudentFeedbackEvents.mockResolvedValue({
      ok: false,
      data: { message: '無法載入處理歷程' },
    });
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('無法載入處理歷程')).toBeInTheDocument();
    expect(screen.getAllByText('預約按鈕沒有反應').length).toBeGreaterThan(1);
    expect(screen.queryByText('尚無處理歷程')).not.toBeInTheDocument();
  });

  test('drops a slow timeline response after the selected case changes', async () => {
    const second = { ...row, id: 129, message: '另一筆回報' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [row, second], page: 1, pageSize: 20, total: 2 },
    });
    api.fetchAdminStudentFeedbackDetail.mockImplementation(async (_token, id) => ({
      ok: true,
      data: { item: Number(id) === 129 ? second : row },
    }));
    let resolveFirst;
    api.fetchAdminStudentFeedbackEvents.mockImplementation(async (_token, id) => {
      if (Number(id) === 128) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return {
        ok: true,
        data: {
          items: [{
            id: 6,
            eventType: 'ASSIGNEE_CHANGED',
            actorType: 'staff',
            actorTeacherId: 8,
            beforeValue: { assignedTeacherId: null },
            afterValue: { assignedTeacherId: 8 },
            createdAt: '2026-11-09T02:00:00.000Z',
          }],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      };
    });
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    fireEvent.click(await screen.findByText('另一筆回報'));
    expect(await screen.findByText('承辦變更')).toBeInTheDocument();
    resolveFirst({
      ok: true,
      data: {
        items: [{
          id: 5,
          eventType: 'STATUS_CHANGED',
          actorType: 'staff',
          actorTeacherId: 9,
          beforeValue: { status: 'open' },
          afterValue: { status: 'in_progress' },
          createdAt: '2026-11-09T01:00:00.000Z',
        }],
        page: 1,
        pageSize: 50,
        total: 1,
      },
    });
    await waitFor(() => {
      expect(screen.queryByText('狀態變更')).not.toBeInTheDocument();
    });
    expect(screen.getByText('承辦變更')).toBeInTheDocument();
  });

  test('reloads the timeline after a status update', async () => {
    api.fetchAdminStudentFeedbackEvents
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: 1, pageSize: 50, total: 0 } })
      .mockResolvedValue({
        ok: true,
        data: {
          items: [{
            id: 11,
            eventType: 'STATUS_CHANGED',
            actorType: 'staff',
            actorTeacherId: 9,
            beforeValue: { status: 'open' },
            afterValue: { status: 'closed' },
            createdAt: '2026-11-09T04:00:00.000Z',
          }],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    await screen.findByText('尚無處理歷程');
    const callsBefore = api.fetchAdminStudentFeedbackEvents.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '結案' }));
    expect(await screen.findByText('新值：已結案')).toBeInTheDocument();
    expect(api.fetchAdminStudentFeedbackEvents.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  test('reloads the timeline after an assignment update', async () => {
    api.fetchFeedbackAssignees.mockResolvedValue({
      ok: true,
      data: { items: [{ id: 4, name: '林承辦', roleLabel: '行政' }] },
    });
    api.fetchAdminStudentFeedbackEvents
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: 1, pageSize: 50, total: 0 } })
      .mockResolvedValue({
        ok: true,
        data: {
          items: [{
            id: 12,
            eventType: 'ASSIGNEE_CHANGED',
            actorType: 'staff',
            actorTeacherId: 4,
            beforeValue: { assignedTeacherId: null },
            afterValue: { assignedTeacherId: 4 },
            createdAt: '2026-11-09T05:00:00.000Z',
          }],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    await screen.findByText('尚無處理歷程');
    const selects = screen.getAllByLabelText('承辦人');
    fireEvent.change(selects[selects.length - 1], { target: { value: '4' } });
    const callsBefore = api.fetchAdminStudentFeedbackEvents.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: '指派' }));
    expect(await screen.findByText('新值：林承辦')).toBeInTheDocument();
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', 128, { assignedTeacherId: 4 });
    expect(api.fetchAdminStudentFeedbackEvents.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  test('loads the next event page without duplicating earlier events', async () => {
    api.fetchAdminStudentFeedbackEvents.mockImplementation(async (_token, _id, query) => {
      if (Number(query?.page) === 2) {
        return {
          ok: true,
          data: {
            items: [
              {
                id: 1,
                eventType: 'STATUS_CHANGED',
                actorType: 'staff',
                actorTeacherId: 9,
                beforeValue: { status: 'open' },
                afterValue: { status: 'in_progress' },
                createdAt: '2026-11-09T01:00:00.000Z',
              },
              {
                id: 2,
                eventType: 'ASSIGNEE_CHANGED',
                actorType: 'student',
                beforeValue: { assignedTeacherId: null },
                afterValue: { assignedTeacherId: 9 },
                createdAt: '2026-11-09T00:30:00.000Z',
              },
            ],
            page: 2,
            pageSize: 50,
            total: 2,
          },
        };
      }
      return {
        ok: true,
        data: {
          items: [{
            id: 1,
            eventType: 'STATUS_CHANGED',
            actorType: 'staff',
            actorTeacherId: 9,
            beforeValue: { status: 'open' },
            afterValue: { status: 'in_progress' },
            createdAt: '2026-11-09T01:00:00.000Z',
          }],
          page: 1,
          pageSize: 50,
          total: 2,
        },
      };
    });
    renderPage();
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    expect(await screen.findByText('狀態變更')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '載入更多' }));
    expect(await screen.findByText('承辦變更')).toBeInTheDocument();
    expect(screen.getAllByText('狀態變更')).toHaveLength(1);
    const assignee = screen.getByText('承辦變更');
    const status = screen.getByText('狀態變更');
    expect(assignee.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('操作者：學生')).toBeInTheDocument();
    expect(api.fetchAdminStudentFeedbackEvents).toHaveBeenCalledWith('staff-token', 128, { page: 2, pageSize: 50 });
  });

  test('shows the category and an unset priority', async () => {
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: {
        items: [{ ...row, categoryLabel: '學習歷程', priority: null, priorityLabel: '未設定' }],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    });
    api.fetchAdminStudentFeedbackDetail.mockResolvedValue({
      ok: true,
      data: { item: { ...row, categoryLabel: '學習歷程', priority: null, priorityLabel: '未設定' } },
    });
    renderPage();
    expect(await screen.findByText('學習歷程')).toBeInTheDocument();
    fireEvent.click(screen.getByText('預約按鈕沒有反應'));
    expect(await screen.findByText('分類：學習歷程 · 優先級：未設定')).toBeInTheDocument();
    expect(screen.queryByLabelText('調整優先級')).not.toBeInTheDocument();
  });

  test('updates the priority and shows the timeline event', async () => {
    api.fetchAdminStudentFeedbackEvents
      .mockResolvedValueOnce({ ok: true, data: { items: [], page: 1, pageSize: 50, total: 0 } })
      .mockResolvedValue({
        ok: true,
        data: {
          items: [{
            id: 21,
            eventType: 'PRIORITY_CHANGED',
            actorType: 'staff',
            actorTeacherId: 9,
            beforeValue: { priority: null },
            afterValue: { priority: 'P1' },
            createdAt: '2026-11-09T06:00:00.000Z',
          }],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    api.patchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: {
        notice: '已更新',
        item: { ...row, priority: 'P1', priorityLabel: 'P1（高）' },
      },
    });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    await screen.findByText('分類：預約 · 優先級：未設定');
    fireEvent.change(screen.getByLabelText('調整優先級'), { target: { value: 'P1' } });
    fireEvent.click(screen.getByRole('button', { name: '更新優先級' }));
    expect(await screen.findByText('優先級由 未設定 調整為 P1（高）。')).toBeInTheDocument();
    expect(screen.getByText('分類：預約 · 優先級：P1（高）')).toBeInTheDocument();
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', 128, { priority: 'P1' });
  });

  test('keeps the previous priority when the update fails', async () => {
    api.patchAdminStudentFeedback.mockResolvedValue({
      ok: false,
      data: { message: '優先級不正確' },
    });
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('預約按鈕沒有反應'));
    await screen.findByLabelText('調整優先級');
    fireEvent.change(screen.getByLabelText('調整優先級'), { target: { value: 'P0' } });
    fireEvent.click(screen.getByRole('button', { name: '更新優先級' }));
    expect(await screen.findByText('優先級不正確')).toBeInTheDocument();
    expect(screen.getByLabelText('調整優先級')).toHaveValue('');
    expect(screen.getByText('分類：預約 · 優先級：未設定')).toBeInTheDocument();
  });

  test('asks the list for the priority filter and sort', async () => {
    renderPage();
    await screen.findByText('#128');
    fireEvent.change(screen.getByLabelText('優先級'), { target: { value: 'unset' } });
    fireEvent.change(screen.getByLabelText('排序欄位'), { target: { value: 'priority' } });
    await waitFor(() => {
      expect(api.fetchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', expect.objectContaining({
        priority: 'unset',
        sortBy: 'priority',
        page: 1,
      }));
    });
  });

  test('keeps the newer case when an older detail response arrives later', async () => {
    const caseA = deferred();
    const caseB = deferred();
    const rowA = { ...row, id: 1, message: '案件A內容', status: 'open' };
    const rowB = { ...row, id: 2, message: '案件B內容', status: 'in_progress' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [rowA, rowB], page: 1, pageSize: 20, total: 2 },
    });
    api.fetchAdminStudentFeedbackDetail.mockReset();
    api.fetchAdminStudentFeedbackDetail
      .mockImplementationOnce(() => caseA.promise)
      .mockImplementationOnce(() => caseB.promise);
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('案件A內容'));
    fireEvent.click(screen.getByText('案件B內容'));
    await act(async () => {
      caseB.resolve({ ok: true, data: { item: rowB } });
    });
    expect(await screen.findByRole('heading', { level: 2, name: '問題回報 · 處理中' })).toBeInTheDocument();
    await act(async () => {
      caseA.resolve({ ok: true, data: { item: rowA } });
    });
    expect(screen.getByRole('heading', { level: 2, name: '問題回報 · 處理中' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '問題回報 · 待處理' })).not.toBeInTheDocument();
  });

  test('does not mutate a case while its detail is still loading', async () => {
    const caseA = deferred();
    const caseB = deferred();
    const rowA = { ...row, id: 11, message: '尚未載入A' };
    const rowB = { ...row, id: 12, message: '尚未載入B' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [rowA, rowB], page: 1, pageSize: 20, total: 2 },
    });
    api.fetchAdminStudentFeedbackDetail.mockReset();
    api.fetchAdminStudentFeedbackDetail
      .mockImplementationOnce(() => caseA.promise)
      .mockImplementationOnce(() => caseB.promise);
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('尚未載入A'));
    fireEvent.click(screen.getByText('尚未載入B'));
    expect(screen.queryByRole('button', { name: '結案' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '指派' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '更新優先級' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '送出回覆' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '記下備註' })).not.toBeInTheDocument();
    expect(api.patchAdminStudentFeedback).not.toHaveBeenCalled();
    expect(api.postAdminStudentFeedbackReply).not.toHaveBeenCalled();
    expect(api.postAdminStudentFeedbackNote).not.toHaveBeenCalled();
    await act(async () => {
      caseA.resolve({ ok: true, data: { item: rowA } });
      caseB.resolve({ ok: true, data: { item: rowB } });
    });
    fireEvent.click(await screen.findByRole('button', { name: '結案' }));
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledTimes(1);
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', 12, { status: 'closed' });
    expect(await screen.findByRole('alert')).toHaveTextContent('已結案');
  });

  test('does not apply a finished update after the selection has changed', async () => {
    const update = deferred();
    const caseB = deferred();
    const rowA = { ...row, id: 21, message: '更新中A', status: 'open' };
    const rowB = { ...row, id: 22, message: '已改選B', status: 'in_progress' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [rowA, rowB], page: 1, pageSize: 20, total: 2 },
    });
    api.fetchAdminStudentFeedbackDetail.mockReset();
    api.fetchAdminStudentFeedbackDetail
      .mockResolvedValueOnce({ ok: true, data: { item: rowA } })
      .mockImplementationOnce(() => caseB.promise);
    api.patchAdminStudentFeedback.mockImplementation(() => update.promise);
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('更新中A'));
    fireEvent.click(await screen.findByRole('button', { name: '結案' }));
    fireEvent.click(screen.getByText('已改選B'));
    await act(async () => {
      update.resolve({
        ok: true,
        data: { notice: '已結案', item: { ...rowA, status: 'closed' } },
      });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => {
      caseB.resolve({ ok: true, data: { item: rowB } });
    });
    expect(await screen.findByRole('heading', { level: 2, name: '問題回報 · 處理中' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledTimes(1);
    expect(api.patchAdminStudentFeedback).toHaveBeenCalledWith('staff-token', 21, { status: 'closed' });
  });

  test('keeps the newer list when an older query finishes later', async () => {
    const older = deferred();
    const newer = deferred();
    api.fetchAdminStudentFeedback.mockReset();
    api.fetchAdminStudentFeedback
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    renderPage();
    fireEvent.change(screen.getByLabelText('狀態'), { target: { value: 'closed' } });
    await act(async () => {
      newer.resolve({
        ok: true,
        data: { items: [{ ...row, id: 32, message: '新條件案件' }], page: 1, pageSize: 20, total: 1 },
      });
    });
    expect(await screen.findByText('新條件案件')).toBeInTheDocument();
    await act(async () => {
      older.resolve({
        ok: true,
        data: { items: [{ ...row, id: 31, message: '舊條件案件' }], page: 1, pageSize: 20, total: 1 },
      });
    });
    expect(screen.getByText('新條件案件')).toBeInTheDocument();
    expect(screen.queryByText('舊條件案件')).not.toBeInTheDocument();
  });

  test('ignores a stale list failure and a stale detail failure', async () => {
    const olderList = deferred();
    const newerList = deferred();
    const olderDetail = deferred();
    const newerDetail = deferred();
    api.fetchAdminStudentFeedback.mockReset();
    api.fetchAdminStudentFeedback
      .mockImplementationOnce(() => olderList.promise)
      .mockImplementationOnce(() => newerList.promise);
    api.fetchAdminStudentFeedbackDetail.mockReset();
    api.fetchAdminStudentFeedbackDetail
      .mockImplementationOnce(() => olderDetail.promise)
      .mockImplementationOnce(() => newerDetail.promise);
    renderPage({ canManage: true });
    fireEvent.change(screen.getByLabelText('狀態'), { target: { value: 'open' } });
    await act(async () => {
      newerList.resolve({
        ok: true,
        data: { items: [{ ...row, id: 41, message: '目前列表' }], page: 1, pageSize: 20, total: 1 },
      });
    });
    fireEvent.click(await screen.findByText('目前列表'));
    fireEvent.click(screen.getByText('目前列表'));
    await act(async () => {
      newerDetail.resolve({ ok: true, data: { item: { ...row, id: 41, message: '目前列表', status: 'open' } } });
    });
    expect(await screen.findByRole('heading', { level: 2, name: '問題回報 · 待處理' })).toBeInTheDocument();
    await act(async () => {
      olderList.reject(new Error('old list'));
      olderDetail.reject(new Error('old detail'));
    });
    expect(screen.queryByText('與伺服器連線發生錯誤')).not.toBeInTheDocument();
    expect(screen.getAllByText('目前列表').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 2, name: '問題回報 · 待處理' })).toBeInTheDocument();
  });

  test('restores the priority after a network error and ignores that failure on the next case', async () => {
    const failure = deferred();
    const caseB = deferred();
    const rowA = { ...row, id: 51, message: '優先級A', priority: 'P1', priorityLabel: 'P1（高）' };
    const rowB = { ...row, id: 52, message: '優先級B', priority: 'P2', priorityLabel: 'P2（中）' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [rowA, rowB], page: 1, pageSize: 20, total: 2 },
    });
    api.fetchAdminStudentFeedbackDetail.mockReset();
    api.fetchAdminStudentFeedbackDetail
      .mockResolvedValueOnce({ ok: true, data: { item: rowA } })
      .mockImplementationOnce(() => caseB.promise);
    api.patchAdminStudentFeedback.mockImplementationOnce(() => failure.promise);
    renderPage({ canManage: true });
    fireEvent.click(await screen.findByText('優先級A'));
    const priority = await screen.findByLabelText('調整優先級');
    expect(priority).toHaveValue('P1');
    fireEvent.change(priority, { target: { value: 'P0' } });
    fireEvent.click(screen.getByRole('button', { name: '更新優先級' }));
    fireEvent.click(screen.getByText('優先級B'));
    await act(async () => {
      failure.reject(new Error('network'));
    });
    await act(async () => {
      caseB.resolve({ ok: true, data: { item: rowB } });
    });
    expect(await screen.findByLabelText('調整優先級')).toHaveValue('P2');
    expect(screen.queryByText('與伺服器連線發生錯誤')).not.toBeInTheDocument();
    expect(screen.getByText('分類：預約 · 優先級：P2（中）')).toBeInTheDocument();
  });

  test('shows an unknown status as its raw value', async () => {
    const unknown = { ...row, status: 'queued', statusLabel: '待處理', message: '未知狀態案件' };
    api.fetchAdminStudentFeedback.mockResolvedValue({
      ok: true,
      data: { items: [unknown], page: 1, pageSize: 20, total: 1 },
    });
    api.fetchAdminStudentFeedbackDetail.mockResolvedValue({ ok: true, data: { item: unknown } });
    renderPage();
    expect(await screen.findByText('queued')).toBeInTheDocument();
    fireEvent.click(screen.getByText('未知狀態案件'));
    expect(await screen.findByRole('heading', { level: 2, name: '問題回報 · queued' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: /待處理/ })).not.toBeInTheDocument();
  });
});
