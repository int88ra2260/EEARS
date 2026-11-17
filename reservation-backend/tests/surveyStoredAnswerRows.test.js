'use strict';

const { buildStoredAnswerRows, activityTypeForSurveyKey } = require('../utils/surveyStoredAnswerRows');

describe('buildStoredAnswerRows', () => {
  const questions = [
    { id: 'q1', type: 'likert' },
    { id: 'grade', type: 'radio' },
    { id: 'reason_attend', type: 'checkbox' },
  ];

  it('writes likert scores and skips respondent fields', () => {
    const rows = buildStoredAnswerRows({
      q1: '4',
      grade: '一年級',
      email: 'student@example.com',
      name: '學生',
      studentId: 'B12345678',
    }, questions);
    expect(rows).toEqual([
      { questionKey: 'q1', questionType: 'likert', answerText: '4', answerJson: null, scoreValue: 4 },
      { questionKey: 'grade', questionType: 'radio', answerText: '一年級', answerJson: null, scoreValue: null },
    ]);
  });

  it('keeps one row when a legacy alias duplicates the schema key', () => {
    const rows = buildStoredAnswerRows({
      reasonAttend: ['口說'],
      reason_attend: ['聽力', '口說'],
    }, questions);
    expect(rows).toHaveLength(1);
    expect(rows[0].questionKey).toBe('reason_attend');
    expect(rows[0].answerJson).toEqual(['聽力', '口說']);
  });

  it('maps ET and EC survey keys to activity types', () => {
    expect(activityTypeForSurveyKey('english_table_feedback_114_1')).toBe('English Table');
    expect(activityTypeForSurveyKey('english_club_feedback_115_1')).toBe('English Club');
    expect(activityTypeForSurveyKey('other')).toBeNull();
  });
});
