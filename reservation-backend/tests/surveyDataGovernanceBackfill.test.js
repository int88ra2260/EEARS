'use strict';

jest.mock('../models', () => ({
  Event: { findAll: jest.fn(), findByPk: jest.fn() },
  Reservation: { findByPk: jest.fn() },
  Semester: { findOne: jest.fn() },
  SurveyModuleResponse: { findAll: jest.fn() },
  SurveyVersion: { findByPk: jest.fn(), findAll: jest.fn() },
  SurveyResponseAnswer: { findAll: jest.fn(), bulkCreate: jest.fn() },
}));

const {
  Semester,
  SurveyModuleResponse,
  SurveyVersion,
  SurveyResponseAnswer,
} = require('../models');
const { backfillResponseLinks } = require('../services/surveyDataGovernanceService');

describe('backfillResponseLinks', () => {
  const response = {
    id: 10,
    semesterId: null,
    semester: '115-1',
    semesterKey: '115-1',
    eventId: null,
    reservationId: null,
    submittedAt: new Date('2026-10-01T00:00:00Z'),
    surveyId: 1,
    surveyVersionId: 2,
    answersJson: {
      q1: '4',
      grade: '一年級',
      email: 'student@example.com',
      name: '學生',
    },
    metadataJson: {},
    update: jest.fn(async function update(payload) {
      Object.assign(this, payload);
      return this;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    response.semesterId = null;
    response.metadataJson = {};
    SurveyModuleResponse.findAll.mockResolvedValue([response]);
    SurveyResponseAnswer.findAll.mockResolvedValue([]);
    SurveyResponseAnswer.bulkCreate.mockResolvedValue([]);
    Semester.findOne.mockResolvedValue({ id: 4 });
    SurveyVersion.findByPk.mockResolvedValue({
      id: 2,
      schemaJson: {
        questions: [
          { id: 'q1', type: 'likert' },
          { id: 'grade', type: 'radio' },
        ],
      },
    });
  });

  it('預覽時用學期代碼與作答內容計算，但不寫入', async () => {
    const stats = await backfillResponseLinks({ dryRun: true });
    expect(stats.semesterBySemesterCode).toBe(1);
    expect(stats.responsesAnswerBackfilled).toBe(1);
    expect(stats.answerRowsBackfilled).toBe(2);
    expect(response.update).not.toHaveBeenCalled();
    expect(SurveyResponseAnswer.bulkCreate).not.toHaveBeenCalled();
  });

  it('執行時寫入學期外鍵，答案列不含信箱與姓名', async () => {
    await backfillResponseLinks({ dryRun: false });
    expect(response.update).toHaveBeenCalledWith(expect.objectContaining({
      semesterId: 4,
      surveyVersionId: 2,
    }));
    const rows = SurveyResponseAnswer.bulkCreate.mock.calls[0][0];
    expect(rows.map((row) => row.questionKey)).toEqual(['q1', 'grade']);
    expect(rows[0]).toEqual(expect.objectContaining({ responseId: 10, scoreValue: 4 }));
    expect(JSON.stringify(rows)).not.toContain('student@example.com');
  });
});
