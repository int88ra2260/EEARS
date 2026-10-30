'use strict';

jest.mock('../models', () => ({
  Survey: {},
  SurveyRule: {},
}));

jest.mock('../services/surveyGateService', () => ({
  EVENT_TYPE_TO_SURVEY_KEY: {
    english_table: 'english_table_feedback_114_1',
  },
  hasCompletedForGate: jest.fn(),
  ruleTimeAllows: jest.fn(() => ({ ok: true })),
}));

const { studentFacingSurveyName } = require('../services/surveyEnabledListService');

describe('studentFacingSurveyName', () => {
  it('活動問卷用活動名稱，不帶問卷代碼裡的學期', () => {
    expect(studentFacingSurveyName(
      { surveyKey: 'english_table_feedback_114_1', name: 'English Table Feedback Questionnaire (114-1, Revised 1013)' },
      'ET'
    )).toBe('English Table 問卷');
    expect(studentFacingSurveyName(
      { surveyKey: 'english_club_feedback_115_1', name: 'English Club Feedback Questionnaire' },
      'english_club'
    )).toBe('English Club 問卷');
  });

  it('其他問卷拿掉標題裡的學期括號', () => {
    expect(studentFacingSurveyName(
      { surveyKey: 'workshop_feedback', title: '工作坊回饋（115-1）' },
      'PUBLIC'
    )).toBe('工作坊回饋');
  });
});
