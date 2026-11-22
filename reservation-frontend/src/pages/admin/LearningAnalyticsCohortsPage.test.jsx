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

function row(groupKey, withExamCount, b2plusCount) {
  return {
    groupKey,
    students: 8,
    withExamCount,
    withoutExamCount: 8 - withExamCount,
    b2plusCount,
    b2plusRate: b2plusCount / 8,
    retestRate: 0,
    avgResourceHours: 2,
    growthEpisodeCount: 0,
    avgActualGseGrowth: null,
    avgAdjustedGseGrowth: null,
  };
}

function payload(groupBy, rows, gradeSemester = null) {
  return {
    snapshotVersion: 'synth-1',
    groupBy,
    gradeSemester,
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

  test('shows exam coverage and snapshot B2 as counts and percents of each group', async () => {
    getLearningAnalyticsCohorts.mockResolvedValue(payload('department', [
      row('外文系', 5, 2),
      row('電機系', 8, 0),
    ]));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: '群體與技能比較' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '群體比較' })).toHaveAttribute('aria-current', 'page');
    const table = await screen.findByTestId('cohort-table');
    expect(within(table).getByText('沒有英檢成績')).toBeInTheDocument();
    expect(within(table).getByText('至少一次英檢成績')).toBeInTheDocument();
    expect(within(table).getByText('B2 達標')).toBeInTheDocument();
    expect(within(table).queryByText('至少兩次測驗')).not.toBeInTheDocument();
    expect(within(table).queryByText('平均 GSE 變化')).not.toBeInTheDocument();
    expect(within(table).queryByText('資料限制')).not.toBeInTheDocument();
    expect(within(table).getByText('3 人 · 37.5%')).toBeInTheDocument();
    expect(within(table).getByText('5 人 · 62.5%')).toBeInTheDocument();
    expect(within(table).getByText('2 人 · 25.0%')).toBeInTheDocument();
    expect(within(table).getByText('8 人 · 100.0%')).toBeInTheDocument();
    expect(within(table).getAllByText('0 人 · 0.0%')).toHaveLength(2);
    expect(screen.queryByRole('combobox', { name: /英檢工具/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^技能/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /曾重測英檢/ })).not.toBeInTheDocument();
  });

  test('opens a department into grade rows instead of the old summary facts', async () => {
    const user = userEvent.setup();
    const foreign = row('外文系', 5, 2);
    foreign.grades = [
      { grade: '大一', gradeNo: 1, students: 5, withExamCount: 4, withoutExamCount: 1, b2plusCount: 2 },
      { grade: '缺年級', gradeNo: null, students: 3, withExamCount: 1, withoutExamCount: 2, b2plusCount: 0 },
    ];
    getLearningAnalyticsCohorts.mockResolvedValue(payload('department', [foreign], '114-2'));
    renderPage();
    const table = await screen.findByTestId('cohort-table');
    await user.click(within(table).getByRole('button', { name: '查看 外文系 詳細資訊' }));
    expect(within(table).getByText('年級依 114-2 在學名冊。各列百分比的分母是該年級人數。缺年級是這份快照有、名冊上沒有年級的人。')).toBeInTheDocument();
    expect(within(table).getByText('大一')).toBeInTheDocument();
    expect(within(table).getByText('缺年級')).toBeInTheDocument();
    expect(within(table).getByText('4 人 · 80.0%')).toBeInTheDocument();
    expect(within(table).queryByText('重測比例')).not.toBeInTheDocument();
    expect(within(table).queryByText('校正後變化')).not.toBeInTheDocument();
  });

  test('ignores a slower group response after the dimension changes', async () => {
    const user = userEvent.setup();
    let releaseFirst;
    getLearningAnalyticsCohorts
      .mockImplementationOnce(() => new Promise((resolve) => {
        releaseFirst = resolve;
      }))
      .mockResolvedValueOnce(payload('college', [row('文學院', 6, 2)]));
    renderPage();
    await waitFor(() => expect(getLearningAnalyticsCohorts).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: '學院' }));
    releaseFirst(payload('department', [row('舊系所', 3, 1)]));
    await waitFor(() => {
      expect(within(screen.getByTestId('cohort-table')).getByText('文學院')).toBeInTheDocument();
    });
    expect(within(screen.getByTestId('cohort-table')).queryByText('舊系所')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '學院' })).toHaveAttribute('aria-pressed', 'true');
  });
});
