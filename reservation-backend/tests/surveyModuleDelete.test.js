/**
 * 以 mock 驗證問卷刪除／版本刪除的決策語意（不連真實 DB）
 */
jest.mock('../models', () => {
  const survey = {
    id: 1,
    surveyKey: 'demo_survey',
    status: 'draft',
    currentPublishedVersionId: null,
    currentVersionId: null,
    toJSON() { return { ...this }; },
    update: jest.fn(async function update(payload) { Object.assign(this, payload); return this; }),
    destroy: jest.fn(async () => undefined),
  };
  return {
    sequelize: { transaction: jest.fn(async () => ({ commit: jest.fn(), rollback: jest.fn() })) },
    Survey: {
      findByPk: jest.fn(async () => survey),
      destroy: jest.fn(async () => 1),
      __survey: survey,
    },
    SurveyVersion: {
      findOne: jest.fn(),
      destroy: jest.fn(async () => 1),
    },
    SurveyRule: {
      findOne: jest.fn(async () => null),
      destroy: jest.fn(async () => 1),
    },
    SurveyModuleResponse: {
      count: jest.fn(async () => 0),
      findAll: jest.fn(async () => []),
      destroy: jest.fn(async () => 0),
    },
    SurveyResponseAnswer: { destroy: jest.fn(async () => 0) },
    SurveyAnswerMapping: { destroy: jest.fn(async () => 0) },
    SurveyAdminAuditLog: { create: jest.fn(async () => ({})) },
    EnglishTableSurveyResponse: { count: jest.fn(async () => 0) },
    EnglishClubSurveyResponse: { count: jest.fn(async () => 0) },
  };
});

jest.mock('../utils/surveyFormValidation', () => ({
  validateSurveyData: jest.fn(),
  processSurveyData: jest.fn(),
}));
jest.mock('../utils/semester', () => ({
  getCurrentSemester: () => '114-2',
  isValidSemester: () => true,
}));
jest.mock('../services/surveyGateService', () => ({
  ruleTimeAllows: () => true,
  legacyModelForSurveyKey: () => null,
}));
jest.mock('../services/accessControl/surveyScopeGuard', () => ({
  mergeWhereWithScope: (where) => where,
}));

const models = require('../models');
const {
  deleteSurvey,
  deleteVersion,
} = require('../services/surveyModuleService');

describe('surveyModuleService delete CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const s = models.Survey.__survey;
    s.id = 1;
    s.surveyKey = 'demo_survey';
    s.status = 'draft';
    s.currentPublishedVersionId = null;
  });

  it('hard-deletes survey when there are no responses', async () => {
    models.SurveyModuleResponse.count.mockResolvedValue(0);
    const result = await deleteSurvey(1, {}, 9);
    expect(result.mode).toBe('deleted');
    expect(models.Survey.destroy).toHaveBeenCalled();
  });

  it('archives survey when responses exist', async () => {
    models.SurveyModuleResponse.count.mockResolvedValue(3);
    const result = await deleteSurvey(1, {}, 9);
    expect(result.mode).toBe('archived');
    expect(models.Survey.__survey.status).toBe('archived');
    expect(models.Survey.destroy).not.toHaveBeenCalled();
  });

  it('refuses deleting published version', async () => {
    models.SurveyVersion.findOne.mockResolvedValue({
      id: 10,
      surveyId: 1,
      status: 'published',
      versionNumber: 2,
      toJSON() { return { id: 10, status: 'published', versionNumber: 2 }; },
      destroy: jest.fn(),
    });
    await expect(deleteVersion(1, 10, 9)).rejects.toMatchObject({
      statusCode: 400,
      code: 'PUBLISHED_VERSION_LOCKED',
    });
  });

  it('deletes draft version', async () => {
    const destroy = jest.fn(async () => undefined);
    models.SurveyVersion.findOne.mockResolvedValue({
      id: 11,
      surveyId: 1,
      status: 'draft',
      versionNumber: 3,
      toJSON() { return { id: 11, status: 'draft', versionNumber: 3 }; },
      destroy,
    });
    const result = await deleteVersion(1, 11, 9);
    expect(result.deleted).toBe(true);
    expect(destroy).toHaveBeenCalled();
  });
});
