'use strict';

jest.mock('../models', () => ({
  SurveyVersion: { findByPk: jest.fn() },
  SurveyModuleResponse: { findAll: jest.fn() },
  SurveyResponseAnswer: { findAll: jest.fn() },
  Event: { findAll: jest.fn() },
}));

const { SurveyModuleResponse, SurveyResponseAnswer, Event } = require('../models');
const { loadAssociationRecords } = require('../services/surveyAnswerReadService');

describe('surveyAnswerReadService.loadAssociationRecords', () => {
  const questions = [
    { id: 'q7', type: 'likert', label: '自信', options: [], scale: ['1', '2', '3', '4', '5'] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Event.findAll.mockResolvedValue([]);
  });

  it('reads likert scores from answersJson and omits respondent fields', async () => {
    SurveyModuleResponse.findAll.mockResolvedValue([
      {
        id: 21,
        activityType: 'English Table',
        eventId: null,
        semester: '114-1',
        answersJson: { q7: 4, email: 'secret@example.com', name: '王小明' },
      },
    ]);
    SurveyResponseAnswer.findAll.mockResolvedValue([]);

    const { records } = await loadAssociationRecords({ where: { surveyVersionId: 9 }, questions });

    expect(records).toHaveLength(1);
    expect(records[0].answers.q7.score).toBe(4);
    expect(records[0].activityType).toBe('English Table');
    const encoded = JSON.stringify(records);
    expect(encoded).not.toContain('secret@example.com');
    expect(encoded).not.toContain('王小明');
    expect(encoded).not.toContain('answersJson');
  });

  it('keeps the answer-row score when answersJson disagrees', async () => {
    SurveyModuleResponse.findAll.mockResolvedValue([
      { id: 4, activityType: 'ET', eventId: null, semester: '114-1', answersJson: { q7: 5 } },
    ]);
    SurveyResponseAnswer.findAll.mockResolvedValue([
      { responseId: 4, questionKey: 'q7', answerText: '2', scoreValue: '2.00', answerJson: null },
    ]);

    const { records } = await loadAssociationRecords({ where: {}, questions });
    expect(records[0].answers.q7.score).toBe(2);
  });
});
