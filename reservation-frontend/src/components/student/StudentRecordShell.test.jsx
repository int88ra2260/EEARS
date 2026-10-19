import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { StudentRecordTabs } from './StudentRecordShell';
import {
  fetchClassCreditAllocation,
  fetchClassCreditNavEnabled,
} from '../../services/classCreditAllocationApi';
import { loadReservationIdentity } from '../../utils/studentIdentityStorage';
import { getCurrentSemester } from '../../utils/semesterUtils';

vi.mock('../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: (key) => key }),
}));

vi.mock('../../services/classCreditAllocationApi', () => ({
  fetchClassCreditNavEnabled: vi.fn(),
  fetchClassCreditAllocation: vi.fn(),
}));

vi.mock('../../utils/studentIdentityStorage', () => ({
  loadReservationIdentity: vi.fn(),
}));

vi.mock('../../utils/semesterUtils', () => ({
  getCurrentSemester: vi.fn(),
}));

const CREDIT_TAB = 'nav.classCreditAllocation';

function renderTabs() {
  return render(
    <MemoryRouter>
      <StudentRecordTabs />
    </MemoryRouter>,
  );
}

describe('StudentRecordTabs 課堂加分配置', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchClassCreditNavEnabled.mockResolvedValue(true);
    loadReservationIdentity.mockReturnValue({
      studentId: 'A12345678',
      studentName: '測試學生',
      studentEmail: 'student@example.com',
    });
    getCurrentSemester.mockReturnValue('114-1');
  });

  test('本學期有修一門課時顯示分頁', async () => {
    fetchClassCreditAllocation.mockResolvedValue({ classCount: 1 });
    renderTabs();
    expect(await screen.findByRole('link', { name: CREDIT_TAB })).toBeInTheDocument();
  });

  test('本學期修多門課時顯示分頁', async () => {
    fetchClassCreditAllocation.mockResolvedValue({ classCount: 2 });
    renderTabs();
    expect(await screen.findByRole('link', { name: CREDIT_TAB })).toBeInTheDocument();
  });

  test('本學期沒有修課時不顯示分頁', async () => {
    fetchClassCreditAllocation.mockResolvedValue({ classCount: 0 });
    renderTabs();
    await waitFor(() => {
      expect(fetchClassCreditAllocation).toHaveBeenCalled();
    });
    await act(async () => {
      await fetchClassCreditAllocation.mock.results[0].value;
    });
    expect(screen.queryByRole('link', { name: CREDIT_TAB })).not.toBeInTheDocument();
  });
});
