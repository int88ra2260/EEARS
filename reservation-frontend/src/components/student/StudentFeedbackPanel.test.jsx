import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import StudentFeedbackPanel from './StudentFeedbackPanel';

const api = vi.hoisted(() => ({
  submitStudentFeedback: vi.fn(),
  fetchMyStudentFeedback: vi.fn(),
  fetchMyStudentFeedbackDetail: vi.fn(),
  postMyStudentFeedbackMessage: vi.fn(),
  STUDENT_FEEDBACK_SEEN_EVENT: 'eears-student-feedback-seen',
}));

vi.mock('../../services/studentFeedbackApi', () => api);

const student = {
  studentId: 'B123456789',
  name: '王小明',
  email: 'student@example.com',
};

function renderPanel() {
  return render(<StudentFeedbackPanel student={student} activated />);
}

describe('學生回報表單', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchMyStudentFeedback.mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    api.submitStudentFeedback.mockResolvedValue({ ok: true, data: { message: '已送到中心。' } });
  });

  test('只在問題回報顯示希望中心回覆', async () => {
    renderPanel();
    expect(await screen.findByLabelText('希望中心回覆')).toBeChecked();

    fireEvent.click(screen.getByLabelText('建議／許願'));
    expect(screen.queryByLabelText('希望中心回覆')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('想許的願或建議'), {
      target: { value: '希望活動可以選擇線上參加。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '送到中心' }));

    await waitFor(() => {
      expect(api.submitStudentFeedback).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'wish',
        replyRequested: false,
      }));
    });
  });

  test('問題回報仍可取消希望中心回覆', async () => {
    renderPanel();
    const reply = await screen.findByLabelText('希望中心回覆');
    fireEvent.click(reply);
    fireEvent.change(screen.getByLabelText('發生了什麼'), {
      target: { value: '預約按鈕按下去沒有反應。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '送到中心' }));

    await waitFor(() => {
      expect(api.submitStudentFeedback).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'problem',
        replyRequested: false,
      }));
    });
  });
});
