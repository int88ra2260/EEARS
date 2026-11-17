'use strict';

jest.mock('../models', () => ({
  sequelize: { transaction: jest.fn(async (work) => work({})) },
  Survey: { findOne: jest.fn() },
  SurveyVersion: { findByPk: jest.fn(), findOne: jest.fn() },
  SurveyRule: { findOne: jest.fn() },
  SurveyModuleResponse: { create: jest.fn(), findOne: jest.fn() },
  SurveyResponseAnswer: { bulkCreate: jest.fn() },
  SurveyAnswerMapping: {},
  SurveyAdminAuditLog: { create: jest.fn() },
  Semester: { findOne: jest.fn() },
}));

jest.mock('../utils/semester', () => ({
  getCurrentSemester: () => '115-1',
  isValidSemester: () => true,
}));

jest.mock('../services/surveyGateService', () => ({
  ruleTimeAllows: () => ({ ok: true }),
  legacyModelForSurveyKey: jest.fn(),
}));

jest.mock('../services/accessControl/surveyScopeGuard', () => ({
  mergeWhereWithScope: (where) => where,
}));

const { sequelize, Survey, SurveyVersion, SurveyRule, SurveyModuleResponse, SurveyResponseAnswer, Semester } = require('../models');
const { legacyModelForSurveyKey } = require('../services/surveyGateService');
const { submitPublicResponse } = require('../services/surveyModuleService');

const surveyKey = 'english_table_feedback_114_1';

describe('submitPublicResponse semester and answers', () => {
  const legacyCreate = jest.fn(async () => ({ id: 1 }));
  const legacyModel = { create: legacyCreate, findOne: jest.fn(async () => null) };

  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (work) => work({}));
    legacyModelForSurveyKey.mockReturnValue(legacyModel);
    Survey.findOne.mockResolvedValue({
      id: 7,
      surveyKey,
      currentPublishedVersionId: 3,
    });
    SurveyVersion.findByPk.mockResolvedValue({
      id: 3,
      status: 'published',
      versionNumber: 1,
      schemaJson: {
        id: surveyKey,
        title: 'English Table',
        questions: [{ id: 'q1', type: 'likert', label: '流利', required: true }],
      },
    });
    SurveyRule.findOne.mockResolvedValue(null);
    Semester.findOne.mockResolvedValue({ id: 4 });
    SurveyModuleResponse.create.mockResolvedValue({ id: 99 });
    SurveyResponseAnswer.bulkCreate.mockResolvedValue([]);
  });

  it('把學期代碼連到學期外鍵，並把量表分數寫進答案表', async () => {
    const result = await submitPublicResponse(surveyKey, { q1: '5' }, {
      studentAccount: { studentId: 'B12345678', name: '學生', email: 'student@example.com' },
      ip: '127.0.0.1',
      get: () => 'test',
    });

    expect(result.message).toContain('已送出');
    expect(SurveyModuleResponse.create).toHaveBeenCalledWith(expect.objectContaining({
      surveyId: 7,
      surveyVersionId: 3,
      semesterId: 4,
      semester: '115-1',
      activityType: 'English Table',
      source: 'public_submit',
    }), expect.any(Object));
    const answers = SurveyResponseAnswer.bulkCreate.mock.calls[0][0];
    expect(answers).toEqual([
      expect.objectContaining({
        responseId: 99,
        questionKey: 'q1',
        questionType: 'likert',
        scoreValue: 5,
      }),
    ]);
    expect(JSON.stringify(answers)).not.toContain('student@example.com');
  });
});
