'use strict';

jest.mock('../services/surveyAnswerReadService', () => ({
  loadVersionContext: jest.fn(),
  loadAssociationRecords: jest.fn(),
}));

jest.mock('../services/surveyCenterService', () => ({
  buildAnalyticsWhere: jest.fn((query) => ({ surveyId: Number(query.surveyId), surveyVersionId: Number(query.versionId) })),
}));

jest.mock('../services/accessControl/surveyScopeGuard', () => ({
  assertCanAccessSurveyById: jest.fn().mockResolvedValue({ id: 3 }),
}));

const { loadVersionContext, loadAssociationRecords } = require('../services/surveyAnswerReadService');
const { buildAnalyticsWhere } = require('../services/surveyCenterService');
const { assertCanAccessSurveyById } = require('../services/accessControl/surveyScopeGuard');
const { itemRelations } = require('../services/surveyAssociationService');

const schemaQuestions = [
  { id: 'grade', type: 'radio', label: '年級', options: ['一年級', '二年級'], scale: [] },
  { id: 'q7', type: 'likert', label: '自信', options: [], scale: ['1', '2', '3', '4', '5'] },
];

describe('surveyAssociationService.itemRelations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadVersionContext.mockResolvedValue({
      version: { id: 9, surveyId: 3, versionNumber: 2, schemaJson: { questions: schemaQuestions } },
      questions: schemaQuestions,
    });
    loadAssociationRecords.mockResolvedValue({
      records: [{
        responseId: 1,
        activityType: 'ET',
        eventId: null,
        semester: '114-1',
        answers: { q7: { text: '5', score: 5 }, grade: { text: '一年級', score: null } },
      }],
      eventLabels: {},
    });
  });

  it('requires one survey version', async () => {
    await expect(itemRelations({}, { id: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SURVEY_VERSION_REQUIRED',
    });
    expect(assertCanAccessSurveyById).not.toHaveBeenCalled();
  });

  it('rejects a version that belongs to another survey', async () => {
    await expect(itemRelations({ versionId: 9, surveyId: 8 }, { id: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'SURVEY_VERSION_MISMATCH',
    });
    expect(assertCanAccessSurveyById).not.toHaveBeenCalled();
  });

  it('checks survey access and suppresses a mean below the clamped threshold', async () => {
    const result = await itemRelations({ versionId: '9', surveyId: '3', minN: 1 }, { id: 4 });
    expect(assertCanAccessSurveyById).toHaveBeenCalledWith({ id: 4 }, 3);
    expect(buildAnalyticsWhere).toHaveBeenCalledWith(expect.objectContaining({
      surveyId: 3,
      versionId: 9,
    }));
    expect(result.minN).toBe(5);
    expect(result.groups[0].cells.q7).toMatchObject({ n: 1, mean: null, suppressed: true });
    expect(JSON.stringify(result)).not.toContain('"score"');
  });
});
