jest.mock('../utils/semester', () => ({
  getCurrentSemester: jest.fn(() => '114-1'),
  isValidSemester: jest.fn((s) => /^\d{3}-[12]$/.test(String(s || ''))),
}));

jest.mock('../models', () => ({
  Survey: { findOne: jest.fn() },
  SurveyRule: { findOne: jest.fn(), findAll: jest.fn() },
  SurveyModuleResponse: { findOne: jest.fn() },
  EnglishTableSurveyResponse: { findOne: jest.fn() },
  EnglishClubSurveyResponse: { findOne: jest.fn() },
}));

const { getCurrentSemester } = require('../utils/semester');
const {
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
  SurveyModuleResponse,
  Survey,
  SurveyRule,
} = require('../models');
const {
  hasCompletedForGate,
  hasCompletedForGateWithSemester,
  resolveGateContext,
  legacyModelForSurveyKey,
} = require('../services/surveyGateService');

describe('surveyGateService resolveGateContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SurveyRule.findAll.mockResolvedValue([]);
    SurveyRule.findOne.mockResolvedValue(null);
    Survey.findOne.mockResolvedValue(null);
  });

  it('非 ET/EC 回 legacy', async () => {
    const ctx = await resolveGateContext('Job Talk');
    expect(ctx).toEqual({ mode: 'legacy' });
    expect(SurveyRule.findAll).not.toHaveBeenCalled();
  });

  it('優先使用啟用規則綁定的問卷 surveyKey', async () => {
    SurveyRule.findAll.mockResolvedValue([
      {
        isRequired: true,
        Survey: { id: 9, surveyKey: 'english_table_feedback_115_1', name: 'ET 115' },
      },
    ]);
    const ctx = await resolveGateContext('English Table');
    expect(ctx.mode).toBe('product');
    expect(ctx.surveyKey).toBe('english_table_feedback_115_1');
    expect(ctx.source).toBe('survey_rule');
    expect(Survey.findOne).not.toHaveBeenCalled();
  });

  it('無規則時回退預設 surveyKey', async () => {
    SurveyRule.findAll.mockResolvedValue([]);
    Survey.findOne.mockResolvedValue({ id: 1, surveyKey: 'english_table_feedback_114_1', name: 'ET' });
    SurveyRule.findOne.mockResolvedValue({ id: 2, surveyId: 1, isEnabled: true });
    const ctx = await resolveGateContext('English Table');
    expect(ctx.mode).toBe('product');
    expect(ctx.surveyKey).toBe('english_table_feedback_114_1');
    expect(ctx.source).toBe('fallback_key');
  });
});

describe('legacyModelForSurveyKey', () => {
  it('支援同系列新學期 surveyKey', () => {
    expect(legacyModelForSurveyKey('english_table_feedback_115_1')).toBe(EnglishTableSurveyResponse);
    expect(legacyModelForSurveyKey('english_club_feedback_114_2')).toBe(EnglishClubSurveyResponse);
    expect(legacyModelForSurveyKey('other')).toBeNull();
  });
});

describe('surveyGateService hasCompletedForGateWithSemester', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    EnglishTableSurveyResponse.findOne.mockResolvedValue(null);
    EnglishClubSurveyResponse.findOne.mockResolvedValue(null);
    SurveyModuleResponse.findOne.mockResolvedValue(null);
  });

  it('hasCompletedForGate 使用 getCurrentSemester（行為不變）', async () => {
    await hasCompletedForGate({
      surveyId: 1,
      surveyKey: 'english_table_feedback_114_1',
      rule: { retakePolicy: 'once_ever' },
      studentId: 'B123456789',
      eventId: 10,
    });
    expect(getCurrentSemester).toHaveBeenCalled();
    expect(EnglishTableSurveyResponse.findOne).toHaveBeenCalledWith({
      where: { studentId: 'B123456789', semester: '114-1' },
    });
  });

  it('hasCompletedForGateWithSemester 可使用指定 semesterCode', async () => {
    await hasCompletedForGateWithSemester({
      surveyId: 1,
      surveyKey: 'english_table_feedback_114_1',
      rule: { retakePolicy: 'once_ever' },
      studentId: 'B123456789',
      semesterCode: '113-2',
    });
    expect(EnglishTableSurveyResponse.findOne).toHaveBeenCalledWith({
      where: { studentId: 'B123456789', semester: '113-2' },
    });
    expect(getCurrentSemester).not.toHaveBeenCalled();
  });

  it('legacy 表有紀錄時視為已完成', async () => {
    EnglishTableSurveyResponse.findOne.mockResolvedValue({ id: 1 });
    const done = await hasCompletedForGateWithSemester({
      surveyKey: 'english_table_feedback_114_1',
      studentId: 'B1',
      semesterCode: '114-1',
    });
    expect(done).toBe(true);
  });

  it('產品化 once_ever 查 survey_responses semester 字串', async () => {
    SurveyModuleResponse.findOne.mockResolvedValue({ id: 99 });
    const done = await hasCompletedForGateWithSemester({
      surveyId: 5,
      surveyKey: 'english_club_feedback_114_1',
      rule: { retakePolicy: 'once_ever' },
      studentId: 'B2',
      semesterCode: '114-2',
    });
    expect(done).toBe(true);
    expect(SurveyModuleResponse.findOne).toHaveBeenCalledWith({
      where: { surveyId: 5, studentId: 'B2', status: 'completed', semester: '114-2' },
    });
  });
});
