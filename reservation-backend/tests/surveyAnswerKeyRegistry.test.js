const {
  isSurveyAnswerMetadataKey,
  resolveSurveyQuestionKeyAlias,
} = require('../services/surveyAnswerKeyRegistry');

describe('surveyAnswerKeyRegistry', () => {
  it('treats respondent fields as metadata', () => {
    expect(isSurveyAnswerMetadataKey('studentId')).toBe(true);
    expect(isSurveyAnswerMetadataKey('name')).toBe(true);
    expect(isSurveyAnswerMetadataKey('email')).toBe(true);
    expect(isSurveyAnswerMetadataKey('q1')).toBe(false);
    expect(isSurveyAnswerMetadataKey('grade')).toBe(false);
  });

  it('resolves legacy camelCase keys', () => {
    expect(resolveSurveyQuestionKeyAlias('interviewEmail')).toBe('interview_email');
    expect(resolveSurveyQuestionKeyAlias('timesThisSemester')).toBe('times_this_semester');
  });
});
