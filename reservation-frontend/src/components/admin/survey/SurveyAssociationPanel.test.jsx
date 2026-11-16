import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import SurveyAssociationPanel from './SurveyAssociationPanel';

const relations = {
  versionId: 9,
  minN: 10,
  note: '這不是因果。',
  groupBy: 'grade',
  groupByLabel: '年級',
  groupOptions: [
    { id: 'grade', label: '年級' },
    { id: 'activityType', label: '活動類型' },
  ],
  questions: [
    { key: 'q7', shortLabel: 'Q7', label: '說英文更有自信' },
    { key: 'q18', shortLabel: 'Q18', label: '總體有益' },
  ],
  suggestedQuestionKeys: ['q7', 'q18'],
  constructs: [{ id: 'overall', label: '總體有益', keys: ['q18'] }],
  groups: [
    {
      key: '一年級',
      label: '一年級',
      responseCount: 12,
      cells: {
        q7: { n: 12, mean: 4.2, sd: 0.4, suppressed: false },
        q18: { n: 3, mean: null, sd: null, suppressed: true, reason: 'MIN_N' },
      },
    },
  ],
  matrix: {
    q7: {
      q7: { n: 12, rho: 1, suppressed: false },
      q18: { n: 12, rho: 0.62, suppressed: false },
    },
    q18: {
      q7: { n: 12, rho: 0.62, suppressed: false },
      q18: { n: 12, rho: 1, suppressed: false },
    },
  },
  message: '',
};

describe('SurveyAssociationPanel', () => {
  test('asks for a survey version before calculating relations', () => {
    render(
      <SurveyAssociationPanel
        versionId=""
        relations={null}
        loading={false}
        error=""
        groupBy=""
        onGroupByChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/請先在上方選擇問卷版本/)).toBeInTheDocument();
  });

  test('shows group means, hides small cells, and prints the correlation', () => {
    render(
      <SurveyAssociationPanel
        versionId="9"
        relations={relations}
        loading={false}
        error=""
        groupBy=""
        onGroupByChange={vi.fn()}
      />,
    );
    expect(screen.getByText('這不是因果。')).toBeInTheDocument();
    expect(screen.getByText('4.2')).toBeInTheDocument();
    expect(screen.getByText('人數不足')).toBeInTheDocument();
    expect(screen.getAllByText('0.62')).toHaveLength(2);
  });

  test('notifies the page when the grouping changes', async () => {
    const user = userEvent.setup();
    const onGroupByChange = vi.fn();
    render(
      <SurveyAssociationPanel
        versionId="9"
        relations={relations}
        loading={false}
        error=""
        groupBy="grade"
        onGroupByChange={onGroupByChange}
      />,
    );
    await user.selectOptions(screen.getByLabelText('關聯分組'), 'activityType');
    expect(onGroupByChange).toHaveBeenCalledWith('activityType');
  });
});
