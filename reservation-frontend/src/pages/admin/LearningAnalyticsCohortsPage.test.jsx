import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import LearningAnalyticsCohortsPage from './LearningAnalyticsCohortsPage';
import { getLearningAnalyticsCohorts, getLearningAnalyticsMeta } from '../../services/learningAnalyticsService';

vi.mock('../../services/learningAnalyticsService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLearningAnalyticsMeta: vi.fn(),
    getLearningAnalyticsCohorts: vi.fn(),
  };
});

const meta = {
  snapshots: [{ snapshotVersion: 'synth-1', label: '合成快照', scope: 'global' }],
  warnings: [],
  recommendedSnapshotVersion: 'synth-1',
  snapshotVersionCount: 1,
  hasAnalyticData: true,
  filterOptions: {
    cohorts: [],
    colleges: [{ value: '文學院', label: '文學院' }],
    departments: [{ value: '外文系', label: '外文系' }],
  },
};

function row(groupKey, episodes, actual) {
  return {
    groupKey,
    students: 8,
    multiExamCount: episodes > 0 ? 6 : 0,
    b2plusRate: 0.25,
    retestRate: 0,
    avgResourceHours: 2,
    growthEpisodeCount: episodes,
    avgActualGseGrowth: actual,
    avgAdjustedGseGrowth: actual == null ? null : 1.2,
  };
}

function payload(groupBy, rows) {
  return {
    snapshotVersion: 'synth-1',
    groupBy,
    totalStudents: 8,
    totalGrowthEpisodes: rows.reduce((sum, item) => sum + item.growthEpisodeCount, 0),
    rows,
    participationComparison: [],
    skillGrowthSummary: [],
    causalClaimAllowed: false,
  };
}

function renderPage() {
  localStorage.setItem('token', 'e30.e30.sig');
  return render(
    <MemoryRouter initialEntries={['/admin/learning-analytics/cohorts']}>
      <LearningAnalyticsCohortsPage />
    </MemoryRouter>
  );
}

describe('cohort comparison workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getLearningAnalyticsMeta.mockResolvedValue(meta);
  });

  test('keeps a zero comparable sample distinct from an observed zero', async () => {
    getLearningAnalyticsCohorts.mockResolvedValue(payload('department', [
      row('外文系', 0, 0),
      row('電機系', 4, 0),
    ]));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: '群體與技能比較' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '群體比較' })).toHaveAttribute('aria-current', 'page');
    const table = await screen.findByTestId('cohort-table');
    expect(within(table).getByText('外文系')).toBeInTheDocument();
    expect(within(table).getByText('無可比較樣本')).toBeInTheDocument();
    expect(within(table).getByText('0.0')).toBeInTheDocument();
    expect(within(table).getByText('無可比較前後測')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /英檢工具/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^技能/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /曾重測英檢/ })).not.toBeInTheDocument();
  });

  test('ignores a slower group response after the dimension changes', async () => {
    const user = userEvent.setup();
    let releaseFirst;
    getLearningAnalyticsCohorts
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = resolve;
      }))
      .mockResolvedValueOnce(payload('college', [row('文學院', 6, 1.5)]));
    renderPage();
    await waitFor(() => expect(getLearningAnalyticsCohorts).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '學院' }));
    releaseFirst(payload('department', [row('舊系所', 3, 2)]));
    await waitFor(() => {
      expect(within(screen.getByTestId('cohort-table')).getByText('文學院')).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('cohort-table')).queryByText('舊系所')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '學院' })).toHaveAttribute('aria-pressed', 'true');
  });
});
