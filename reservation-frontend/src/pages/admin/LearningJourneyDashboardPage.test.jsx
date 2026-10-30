import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LearningJourneyDashboardPage from './LearningJourneyDashboardPage';
import {
  getLearningJourneyV3B2Report,
  getLearningJourneyV3Breakdown,
  getLearningJourneyV3Students,
} from '../../services/learningJourneyV3Api';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({}),
  };
});

vi.mock('../../services/learningJourneyV3Api', () => ({
  getLearningJourneyV3B2Report: vi.fn(),
  getLearningJourneyV3Breakdown: vi.fn(),
  getLearningJourneyV3Students: vi.fn(),
}));

function jwt(payload) {
  return `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

function emptyStudents() {
  return Promise.resolve({
    items: [],
    pagination: { total: 0, limit: 20, offset: 0, returned: 0 },
    filters: { departments: [], grades: [] },
  });
}

function renderPage(path = '/admin/learning-journey') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LearningJourneyDashboardPage />
    </MemoryRouter>
  );
}

describe('learning journey dashboard empty state wiring', () => {
  beforeEach(() => {
    localStorage.clear();
    getLearningJourneyV3B2Report.mockReset();
    getLearningJourneyV3Breakdown.mockReset();
    getLearningJourneyV3Students.mockReset();
    getLearningJourneyV3B2Report.mockResolvedValue(null);
    getLearningJourneyV3Breakdown.mockResolvedValue([]);
    getLearningJourneyV3Students.mockImplementation(emptyStudents);
  });

  test('keeps the permission message instead of an empty student list', async () => {
    localStorage.setItem('token', jwt({ role: 'worker', workerLevel: 'event_ops' }));
    renderPage();
    expect(screen.getByText('您沒有檢視英語學習歷程的權限。')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
    expect(screen.queryByLabelText('學期')).toBeNull();
  });

  test('keeps the semester control when the student list is empty', async () => {
    localStorage.setItem('token', jwt({ role: 'admin' }));
    renderPage('/admin/learning-journey?semester=114-2');
    expect(await screen.findByText('此學期目前沒有學生資料。')).toBeInTheDocument();
    expect(screen.getByLabelText('學期')).toHaveValue('114-2');
    expect(screen.queryByText('沒有符合篩選條件的學生。')).toBeNull();
  });

  test('uses the filter empty state when the current query has a keyword', async () => {
    localStorage.setItem('token', jwt({ role: 'admin' }));
    renderPage('/admin/learning-journey?semester=114-2&keyword=nobody');
    expect(await screen.findByText('沒有符合篩選條件的學生。')).toBeInTheDocument();
    expect(screen.queryByText('此學期目前沒有學生資料。')).toBeNull();
    expect(screen.getByLabelText('學期')).toBeInTheDocument();
    await waitFor(() => {
      expect(getLearningJourneyV3Students).toHaveBeenCalled();
    });
    const query = getLearningJourneyV3Students.mock.calls.at(-1)[2];
    expect(query.keyword).toBe('nobody');
  });
});
