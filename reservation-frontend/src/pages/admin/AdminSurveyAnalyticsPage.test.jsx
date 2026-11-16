import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import AdminSurveyAnalyticsPage from './AdminSurveyAnalyticsPage';
import {
  fetchSurveyAnalyticsBundle,
  fetchSurveyCenterOptions,
  fetchSurveyItemRelations,
} from '../../services/surveyAdminApi';

vi.mock('recharts', () => {
  const Pass = ({ children }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    BarChart: Pass,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    LineChart: Pass,
    Line: () => null,
    PieChart: Pass,
    Pie: () => null,
    Cell: () => null,
    Legend: () => null,
  };
});

const toast = vi.hoisted(() => ({ success: vi.fn(), danger: vi.fn() }));

vi.mock('../../components/ui/useToast', () => ({
  default: () => toast,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      token: 'header.test-token.sig',
      userRole: 'admin',
    }),
  };
});

vi.mock('../../services/surveyAdminApi', () => ({
  downloadBlob: vi.fn(),
  exportSurveyAnalyticsXlsx: vi.fn(),
  fetchSurveyAnalyticsBundle: vi.fn(),
  fetchSurveyCenterOptions: vi.fn(),
  fetchSurveyItemRelations: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/survey-analytics']}>
      <Routes>
        <Route path="/admin/survey-analytics" element={<AdminSurveyAnalyticsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminSurveyAnalyticsPage item relations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSurveyCenterOptions.mockResolvedValue({
      semesters: [],
      surveys: [{ id: 3, title: 'ET 回饋' }],
      versions: [{ id: 9, surveyId: 3, versionNumber: 2 }],
      events: [],
    });
    fetchSurveyAnalyticsBundle.mockResolvedValue({
      overview: {
        totalResponses: 12,
        completionRate: 80,
        averageSatisfaction: 4.1,
        activityCoverage: 2,
        surveyCoverage: 1,
      },
      distribution: {
        questions: [{
          questionKey: 'q7',
          questionType: 'likert',
          label: '說英文更有自信',
          distribution: { 4: 8, 5: 4 },
          optionOrder: ['1', '2', '3', '4', '5'],
          averageScore: 4.33,
        }],
      },
      trends: { rows: [] },
      comparison: { rows: [] },
      openTextSummary: { total: 0, rows: [], topTokens: [] },
      sentimentSummary: {
        total: 0,
        distribution: { positive: 0, neutral: 0, negative: 0 },
        percentages: { positive: 0, neutral: 0, negative: 0 },
        averageScore: 0,
        byQuestion: [],
        topPositiveTerms: [],
        topNegativeTerms: [],
        samples: [],
        method: '',
      },
    });
    fetchSurveyItemRelations.mockResolvedValue({
      versionId: 9,
      minN: 10,
      note: '這不是因果。',
      groupBy: 'grade',
      groupByLabel: '年級',
      groupOptions: [{ id: 'grade', label: '年級' }],
      questions: [{ key: 'q7', shortLabel: 'Q7', label: '說英文更有自信' }],
      suggestedQuestionKeys: ['q7'],
      constructs: [],
      groups: [{
        key: '一年級',
        label: '一年級',
        responseCount: 12,
        cells: { q7: { n: 12, mean: 4.2, sd: 0.4, suppressed: false } },
      }],
      matrix: { q7: { q7: { n: 12, rho: 1, suppressed: false } } },
      message: '',
    });
  });

  test('asks for a version, shows question labels, then loads relations', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('說英文更有自信')).toBeInTheDocument();
    expect(screen.getByText('量表題平均分')).toBeInTheDocument();
    expect(screen.getByText(/請先在上方選擇問卷版本/)).toBeInTheDocument();
    expect(fetchSurveyItemRelations).not.toHaveBeenCalled();

    const versionSelect = screen.getAllByRole('combobox').find((element) => element.querySelector('option[value="9"]'));
    await user.selectOptions(versionSelect, '9');

    await waitFor(() => {
      expect(fetchSurveyItemRelations).toHaveBeenCalled();
    });
    expect(await screen.findByText('4.2')).toBeInTheDocument();
    const params = fetchSurveyItemRelations.mock.calls.at(-1)[1];
    expect(String(params)).toContain('versionId=9');
  });
});
