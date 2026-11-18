import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LearningAnalyticsOverviewPage from './LearningAnalyticsOverviewPage';
import {
  getLearningAnalyticsMeta,
  getLearningAnalyticsOverview,
  getLearningAnalyticsOverviewStudents,
} from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLearningAnalyticsMeta: vi.fn(),
    getLearningAnalyticsOverview: vi.fn(),
    getLearningAnalyticsOverviewStudents: vi.fn(),
  };
});

const meta = {
  snapshots: [],
  warnings: [],
  recommendedSnapshotVersion: 'synthetic-snapshot',
  hasAnalyticData: true,
};

const overview = {
  hasData: true,
  dashboard: {
    ability: {
      total: 4,
      overall: { rate: 0.25, count: 1, total: 4 },
      skills: [],
      byDepartment: [],
      byCohortLevel: [
        { cohort: '114', total: 1, b1: 0, b1Plus: 1, noExam: 0, b1Rate: 0, b1PlusRate: 1, noExamRate: 0 },
        { cohort: '113', total: 3, b1: 1, b1Plus: 0, noExam: 1, b1Rate: 0.3333, b1PlusRate: 0, noExamRate: 0.3333 },
      ],
    },
    growth: { baseline: [], skills: [], coverage: {} },
  },
};

describe('learning analytics overview cohort levels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    getLearningAnalyticsMeta.mockResolvedValue(meta);
    getLearningAnalyticsOverview.mockResolvedValue(overview);
    getLearningAnalyticsOverviewStudents.mockResolvedValue({
      total: 1,
      items: [{ studentId: 'D114', studentName: '合成學生', department: '外文系', cohort: '114' }],
    });
  });

  test('shows B1, B1+ and no-exam rates by admission year, then opens that grade list', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LearningAnalyticsOverviewPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('各入學年度的 B1、B1+ 與尚無英檢')).toBeTruthy();
    const table = screen.getAllByRole('table')[0];
    const rows = within(table).getAllByRole('row');
    const textOf = (label) => rows.find((row) => row.textContent.includes(label)).textContent;
    expect(textOf('114')).toContain('1（100.0%）');
    expect(textOf('113')).toContain('1（33.3%）');
    expect(textOf('113')).toContain('0（0.0%）');
    expect(within(table).queryByRole('button', { name: '0（0.0%）' })).toBeNull();

    await user.click(within(table).getByRole('button', { name: '1（100.0%）' }));
    expect(await screen.findByRole('heading', { name: '114 B1+' })).toBeTruthy();
    expect(getLearningAnalyticsOverviewStudents).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ slice: 'cohort_b1_plus', grade: '114' }),
      expect.anything()
    );
  });
});
