import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import AnalyticsSection from './AnalyticsSection';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  BarChart: ({ children }) => <div>{children}</div>,
  CartesianGrid: () => null,
  LineChart: ({ children }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Cell: () => null,
}));

const readyProps = {
  loading: false,
  error: '',
  semester: '114-2',
  activeSemester: '114-2',
  availableSemesters: ['114-2', '113-2'],
  semesterCounts: { '114-2': 120, '113-2': 98 },
  grade: {
    total: 100,
    data: [
      { label: '一年級', count: 40 },
      { label: '二年級', count: 35 },
      { label: '四年級', count: 0 },
    ],
  },
  department: {
    total: 100,
    data: [{ label: '合成學系', count: 60 }],
  },
  infoSource: {
    total: 90,
    data: [{ label: '同學告知', count: 50 }],
  },
  registrationSummary: {
    rowCount: 120,
    distinctStudentCount: 120,
    successStudentCount: 96,
    examPopulationStudentCount: 90,
    byExamType: { LRSW: 70, LR: 20, SW: 15, NON: 10, other: 5 },
  },
  attendance: {
    importStatus: 'imported',
    confirmedAttendance: false,
    presentLabel: '匯入紀錄標示出席，來源尚待確認',
    ignoredAggregateRows: 2,
    unmatchedImportRows: 1,
    skills: {
      L: { eligible: 80, imported: 70, markedPresent: 60, markedAbsent: 10, missingRecord: 10, status: 'imported' },
      R: { eligible: 80, imported: 70, markedPresent: 55, markedAbsent: 15, missingRecord: 10, status: 'imported' },
      S: { eligible: 40, imported: 30, markedPresent: 20, markedAbsent: 10, missingRecord: 10, status: 'imported' },
      W: { eligible: 40, imported: 28, markedPresent: 18, markedAbsent: 10, missingRecord: 12, status: 'imported' },
    },
  },
  scores: {
    importStatus: 'imported',
    cefrResolutionNote: '圖上是匯入後保存的等級。未達 A1 會記成 A1；加號會拿掉，所以 B2+ 存成 B2，不會變成 C1。C1 與 C2 原樣保留。不能還原更細的等級。',
    skills: {
      listening: {
        label: '聽力', withScore: 50, missingAmongEligible: 30, eligible: 80,
        cefr: { A1: 5, A2: 8, B1: 12, B2: 20, C1: 3, C2: 1, unrecognized: 0, missing: 1 },
        b2LevelCount: 20, b2OrAboveCount: 24, denominator: 50, status: 'imported',
      },
      reading: {
        label: '閱讀', withScore: 40, missingAmongEligible: 40, eligible: 80,
        cefr: { A1: 4, A2: 6, B1: 10, B2: 16, C1: 2, C2: 1, unrecognized: 0, missing: 1 },
        b2LevelCount: 16, b2OrAboveCount: 19, denominator: 40, status: 'imported',
      },
      speaking: {
        label: '口說', withScore: 20, missingAmongEligible: 20, eligible: 40,
        cefr: { A1: 2, A2: 3, B1: 5, B2: 8, C1: 1, C2: 0, unrecognized: 0, missing: 1 },
        b2LevelCount: 8, b2OrAboveCount: 9, denominator: 20, status: 'imported',
      },
      writing: {
        label: '寫作', withScore: 18, missingAmongEligible: 22, eligible: 40,
        cefr: { A1: 2, A2: 3, B1: 4, B2: 7, C1: 1, C2: 0, unrecognized: 0, missing: 1 },
        b2LevelCount: 7, b2OrAboveCount: 8, denominator: 18, status: 'imported',
      },
    },
  },
  onSemesterChange: vi.fn(),
};

describe('AnalyticsSection registration view', () => {
  test('states the registration population and does not invent attendance', () => {
    render(<AnalyticsSection {...readyProps} />);

    expect(screen.getByRole('heading', { name: '培力英檢數據分析' })).toBeInTheDocument();
    expect(screen.getByText(/目前查看：114 學年第 2 學期。報名筆數不是到考人數。/)).toBeInTheDocument();
    expect(screen.getByText(/目前查看：/)).not.toHaveTextContent('（目前）');
    expect(screen.getByRole('option', { name: /114 學年第 2 學期（目前學期）/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    expect(screen.getByText(/單位：筆/)).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
    expect(screen.queryByText('尚未統計')).not.toBeInTheDocument();
    expect(screen.queryByText(/到考率/)).not.toBeInTheDocument();
    expect(screen.getByText(/另外 20 筆空白/)).toBeInTheDocument();
    expect(screen.getByTestId('registration-chart')).toBeInTheDocument();
  });

  test('keeps a recorded zero distinct from a missing count in the table', () => {
    render(<AnalyticsSection {...readyProps} />);
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    fireEvent.click(screen.getByRole('button', { name: '明細' }));

    expect(screen.getByRole('row', { name: /一年級/ })).toHaveTextContent('40');
    expect(screen.getByRole('row', { name: /一年級/ })).toHaveTextContent('40.0%');
    expect(screen.getByRole('row', { name: /四年級/ })).toHaveTextContent('0');
    expect(screen.getByRole('row', { name: /四年級/ })).toHaveTextContent('0.0%');
    expect(screen.queryByTestId('registration-chart')).not.toBeInTheDocument();
  });

  test('switches among supported registration views without adding a route', () => {
    render(<AnalyticsSection {...readyProps} />);
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    fireEvent.click(screen.getByRole('button', { name: '系所分布' }));
    fireEvent.click(screen.getByRole('button', { name: '明細' }));
    expect(screen.getByRole('row', { name: /合成學系/ })).toHaveTextContent('60');

    fireEvent.click(screen.getByRole('button', { name: '各學期報名' }));
    fireEvent.click(screen.getByRole('button', { name: '明細' }));
    expect(screen.getByRole('row', { name: /114 學年第 2 學期/ })).toHaveTextContent('120');
    expect(screen.getByText(/不是技能表現/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '報考項目' }));
    fireEvent.click(screen.getByRole('button', { name: '明細' }));
    expect(screen.getByRole('row', { name: /不報考/ })).toHaveTextContent('10');
    expect(screen.getByText(/不進入聽、讀、說、寫的應考母體/)).toBeInTheDocument();
  });

  test('shows attendance records without turning them into a confirmed rate', () => {
    render(<AnalyticsSection {...readyProps} />);
    fireEvent.click(screen.getByRole('tab', { name: '出席紀錄' }));

    expect(screen.getByText(/匯入紀錄標示出席，來源尚待確認/)).toBeInTheDocument();
    expect(screen.getByText(/頁面也不計算到考率/)).toBeInTheDocument();
    expect(screen.getByText('沒有匯入紀錄')).toBeInTheDocument();
    expect(screen.getByTestId('attendance-chart')).toBeInTheDocument();
    expect(screen.queryByText('到考率')).not.toBeInTheDocument();
  });

  test('uses each skill score denominator and states the CEFR resolution limit', () => {
    render(<AnalyticsSection {...readyProps} />);
    fireEvent.click(screen.getByRole('tab', { name: '四技能成績' }));

    expect(screen.getByText(/不能還原更細的等級/)).toBeInTheDocument();
    expect(screen.getByText('24／50 人（48.0%）')).toBeInTheDocument();
    expect(screen.getByText(/分子是 B2、B2\+、C1、C1\+、C2、C2\+/)).toBeInTheDocument();
    expect(screen.getByTestId('score-chart')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '閱讀' }));
    expect(screen.getByText('19／40 人（47.5%）')).toBeInTheDocument();
    expect(screen.queryByText(/到考率/)).not.toBeInTheDocument();
  });

  test('does not draw absent bars when the semester has no attendance import', () => {
    render(<AnalyticsSection {...readyProps} attendance={{ importStatus: 'none', skills: { L: { eligible: 80, markedAbsent: null, missingRecord: null } } }} />);
    fireEvent.click(screen.getByRole('tab', { name: '出席紀錄' }));

    expect(screen.getByText(/缺少匯入列不是缺席/)).toBeInTheDocument();
    expect(screen.queryByTestId('attendance-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('紀錄為缺席')).not.toBeInTheDocument();
  });

  test('refuses an all-semester attendance total', () => {
    render(<AnalyticsSection {...readyProps} semester="all" attendance={{ importStatus: 'not_for_all_semesters' }} />);
    fireEvent.click(screen.getByRole('tab', { name: '出席紀錄' }));
    expect(screen.getByText(/不能把不同考試的出席紀錄加總/)).toBeInTheDocument();
  });

  test('keeps cross-semester attendance totals out and compares score rates by sitting', () => {
    render(<AnalyticsSection {...readyProps} />);
    expect(screen.queryByRole('tab', { name: '歷年比較' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '歷年四項成績技能達成率' })).toBeInTheDocument();
    expect(screen.getAllByText(/人數不加總/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    expect(screen.getByText(/各次考試的達 B2 以上在決策概況/)).toBeInTheDocument();
    expect(screen.getByText(/出席不跨學期比較/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '各學期報名' })).toBeInTheDocument();
  });

  test('shows a true zero B2 ratio and hides a percentage when nobody has a score', () => {
    const { rerender } = render(
      <AnalyticsSection
        {...readyProps}
        scores={{
          importStatus: 'imported',
          cefrResolutionNote: '不能還原更細的等級。',
          skills: {
            listening: {
              label: '聽力', withScore: 10, missingAmongEligible: 0, eligible: 10,
              cefr: { A1: 10, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unrecognized: 0, missing: 0 },
              b2LevelCount: 0, b2OrAboveCount: 0, denominator: 10, status: 'imported',
            },
          },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '四技能成績' }));
    expect(screen.getByText('0／10 人（0.0%）')).toBeInTheDocument();

    rerender(
      <AnalyticsSection
        {...readyProps}
        scores={{
          importStatus: 'imported',
          cefrResolutionNote: '不能還原更細的等級。',
          skills: {
            listening: {
              label: '聽力', withScore: 0, missingAmongEligible: 4, eligible: 4,
              cefr: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unrecognized: 0, missing: 0 },
              b2LevelCount: 0, b2OrAboveCount: 0, denominator: 0, status: 'imported',
            },
          },
        }}
      />,
    );
    expect(screen.getByText('沒有有成績的人')).toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });

  test('shows empty, loading, and error without filling numbers', () => {
    const { rerender } = render(<AnalyticsSection {...readyProps} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('載入統計資料中');
    expect(screen.queryByText('120')).not.toBeInTheDocument();

    rerender(
      <AnalyticsSection
        {...readyProps}
        loading={false}
        semesterCounts={{ '114-2': 0 }}
        grade={{ total: 0, data: [] }}
        department={{ total: 0, data: [] }}
        infoSource={{ total: 0, data: [] }}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    expect(screen.getByRole('status')).toHaveTextContent('這個範圍沒有報名資料');

    rerender(<AnalyticsSection {...readyProps} error="合成統計失敗" />);
    expect(screen.getByRole('alert')).toHaveTextContent('合成統計失敗');
    expect(screen.queryByText('96')).not.toBeInTheDocument();
  });

  test('changes only the existing semester filter', () => {
    const onSemesterChange = vi.fn();
    render(<AnalyticsSection {...readyProps} onSemesterChange={onSemesterChange} />);
    fireEvent.change(screen.getByLabelText('學期'), { target: { value: 'all' } });
    expect(onSemesterChange).toHaveBeenCalledWith('all');
  });
});

const sittingB2Rates = {
  sumsPeople: false,
  note: '各次考試各自計算。人數不加總。同一位學生可以出現在多次考試。',
  sittings: [
    {
      semester: '113-1',
      importStatus: 'none',
      skills: {
        listening: { b2OrAboveCount: null, denominator: null },
        reading: { b2OrAboveCount: null, denominator: null },
        speaking: { b2OrAboveCount: null, denominator: null },
        writing: { b2OrAboveCount: null, denominator: null },
      },
    },
    {
      semester: '113-2',
      importStatus: 'imported',
      skills: {
        listening: { b2OrAboveCount: 1, b2LevelCount: 0, denominator: 1 },
        reading: { b2OrAboveCount: 0, b2LevelCount: 0, denominator: 1 },
        speaking: { b2OrAboveCount: 0, b2LevelCount: 0, denominator: 0 },
        writing: { b2OrAboveCount: null, b2LevelCount: null, denominator: null },
      },
    },
    {
      semester: '114-2',
      importStatus: 'imported',
      skills: {
        listening: { b2OrAboveCount: 1, b2LevelCount: 1, denominator: 2 },
        reading: { b2OrAboveCount: 1, b2LevelCount: 1, denominator: 2 },
        speaking: { b2OrAboveCount: 0, b2LevelCount: 0, denominator: 2 },
        writing: { b2OrAboveCount: 2, b2LevelCount: 2, denominator: 2 },
      },
    },
  ],
};

describe('AnalyticsSection decision overview', () => {
  test('shows this sitting grade, import status, and B2 share on the default view', () => {
    render(<AnalyticsSection {...readyProps} />);

    expect(screen.getByRole('tab', { name: '決策概況' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: '這次考試的年級組成' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '這次考試的四技能匯入狀態' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '這次考試的四技能等級與達 B2 以上' })).toBeInTheDocument();
    expect(screen.getByTestId('grade-composition-chart')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /一年級/ })).toHaveTextContent('40.0%');
    expect(screen.getByRole('row', { name: /四年級/ })).toHaveTextContent('0.0%');
    expect(screen.getByText(/另外 20 筆空白/)).toBeInTheDocument();
    expect(screen.getByTestId('attendance-overview-chart')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '沒有匯入紀錄' })).toBeInTheDocument();
    expect(screen.getByText(/這不是到考率/)).toBeInTheDocument();
    expect(screen.queryByText('到考率')).not.toBeInTheDocument();
    expect(screen.getByTestId('score-overview-chart')).toBeInTheDocument();
    expect(screen.getByText('24／50 人（48.0%）')).toBeInTheDocument();
    expect(screen.getByText('19／40 人（47.5%）')).toBeInTheDocument();
    expect(screen.getByText('9／20 人（45.0%）')).toBeInTheDocument();
    expect(screen.getByText('8／18 人（44.4%）')).toBeInTheDocument();
  });

  test('compares sitting rates without adding people across exams', () => {
    render(<AnalyticsSection {...readyProps} sittingB2Rates={sittingB2Rates} />);

    const chart = screen.getByTestId('sitting-b2-chart');
    expect(chart).toHaveAttribute('data-chart', 'bar');
    expect(screen.getByRole('row', { name: /113 學年第 1 學期/ })).toHaveTextContent('沒有成績匯入');
    expect(screen.getByRole('row', { name: /113 學年第 2 學期/ })).toHaveTextContent('1／1 人（100.0%）');
    expect(screen.getByRole('row', { name: /113 學年第 2 學期/ })).toHaveTextContent('沒有有成績的人');
    expect(screen.getByRole('row', { name: /114 學年第 2 學期/ })).toHaveTextContent('1／2 人（50.0%）');
    expect(screen.queryByText(/2／3/)).not.toBeInTheDocument();
    expect(screen.queryByText('66.7%')).not.toBeInTheDocument();
  });

  test('keeps the three sitting charts closed when every semester is selected', () => {
    render(
      <AnalyticsSection
        {...readyProps}
        semester="all"
        attendance={{ importStatus: 'not_for_all_semesters' }}
        scores={{ importStatus: 'not_for_all_semesters' }}
        sittingB2Rates={sittingB2Rates}
      />,
    );

    expect(screen.getByText(/請改選單一學期/)).toBeInTheDocument();
    expect(screen.queryByTestId('grade-composition-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('attendance-overview-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('score-overview-chart')).not.toBeInTheDocument();
    expect(screen.getByTestId('sitting-b2-chart')).toBeInTheDocument();
  });

  test('does not draw an attendance stack when this sitting has no import', () => {
    render(
      <AnalyticsSection
        {...readyProps}
        attendance={{ importStatus: 'none', skills: { L: { eligible: 80, markedAbsent: null, missingRecord: null } } }}
      />,
    );

    expect(screen.getByText(/缺少匯入列不是缺席/)).toBeInTheDocument();
    expect(screen.queryByTestId('attendance-overview-chart')).not.toBeInTheDocument();
    expect(screen.queryByText('紀錄為缺席')).not.toBeInTheDocument();
  });

  test('keeps the historical achievement chart as grouped bars', () => {
    const sittings = Array.from({ length: 7 }, (_, index) => ({
      semester: `11${index}-1`,
      importStatus: 'imported',
      skills: {
        listening: { b2OrAboveCount: 1, denominator: 2 },
        reading: { b2OrAboveCount: 1, denominator: 2 },
        speaking: { b2OrAboveCount: 0, denominator: 2 },
        writing: { b2OrAboveCount: 2, denominator: 2 },
      },
    }));
    render(
      <AnalyticsSection
        {...readyProps}
        sittingB2Rates={{ sumsPeople: false, note: '人數不加總。', sittings }}
      />,
    );

    expect(screen.getByRole('heading', { name: '歷年四項成績技能達成率' })).toBeInTheDocument();
    expect(screen.getByTestId('sitting-b2-chart')).toHaveAttribute('data-chart', 'bar');
    expect(screen.queryByText(/改用折線/)).not.toBeInTheDocument();
  });

  test('shows a google form registration count without replacing a system semester', () => {
    render(
      <AnalyticsSection
        {...readyProps}
        registrationCountSeries={[
          { semester: '113-2', count: 80, source: 'google_form' },
          { semester: '114-2', count: 120, source: 'system' },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: '報名概況' }));
    fireEvent.click(screen.getByRole('button', { name: '各學期報名' }));
    fireEvent.click(screen.getByRole('button', { name: '明細' }));

    expect(screen.getByRole('row', { name: /113 學年第 2 學期（表單彙總）/ })).toHaveTextContent('80');
    expect(screen.getByRole('row', { name: /114 學年第 2 學期/ })).toHaveTextContent('120');
    expect(screen.getByText(/表單彙總的學期來自 Google 表單常數/)).toBeInTheDocument();
  });

  test('shows part achievement, prior weakness, and separate B1 and B1+ groups', () => {
    render(
      <AnalyticsSection
        {...readyProps}
        partDiagnostics={{
          comparisonNote: '弱項用達成率比較。',
          history: {
            sumsPeople: false,
            note: '各次考試各自計算平均達成率。',
            semesters: ['113-2', '114-1'],
            parts: [
              {
                skill: 'speaking',
                skillLabel: '口說',
                part: 3,
                label: '口說第三部分',
                fullMark: 150,
                bySemester: {
                  '113-2': { count: 10, meanRate: 48, weakest: true },
                  '114-1': { count: 12, meanRate: 61, weakest: false },
                },
              },
            ],
          },
          preExam: {
            status: 'ready',
            note: '細項用他們最近一次更早的培力成績。',
            registeredStudentCount: 8,
            withPriorParts: 5,
            withoutPriorParts: 3,
            parts: [
              {
                skill: 'speaking',
                skillLabel: '口說',
                part: 3,
                label: '口說第三部分',
                fullMark: 150,
                count: 5,
                meanRate: 52,
                weakest: true,
              },
            ],
          },
          approachingB2: {
            status: 'ready',
            note: '依該科自己的 CEFR 圈出 B1 與 B1+。',
            skills: [
              {
                skill: 'speaking',
                label: '口說',
                groups: [
                  {
                    level: 'B1',
                    count: 4,
                    parts: [{ part: 3, label: '第三部分', fullMark: 150, count: 4, meanRate: 41, weakest: true }],
                  },
                  {
                    level: 'B1+',
                    count: 2,
                    parts: [{ part: 3, label: '第三部分', fullMark: 150, count: 2, meanRate: 58, weakest: true }],
                  },
                ],
              },
            ],
          },
        }}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: '部分細項' }));
    expect(screen.getByRole('heading', { name: '各次考試的部分達成率' })).toBeInTheDocument();
    expect(screen.getByText('48.0%（10 人，較弱）')).toBeInTheDocument();
    expect(screen.getByText('61.0%（12 人）')).toBeInTheDocument();
    expect(screen.getByText('52.0%（5 人，較弱）')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'B1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'B1+' })).toBeInTheDocument();
    expect(screen.getByText('41.0%（4 人，較弱）')).toBeInTheDocument();
    expect(screen.getByText('弱項用達成率比較。')).toBeInTheDocument();
  });
});
