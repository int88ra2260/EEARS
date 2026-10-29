'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../models', () => ({
  sequelize: { literal: (sql) => ({ val: sql }) },
  SurveyModuleResponse: { findOne: jest.fn() },
  SurveyResponseAnswer: {},
  Survey: {},
  SurveyVersion: {},
  SurveyRule: {},
  Semester: {},
  Event: {},
  EnglishTableSurveyResponse: { findOne: jest.fn() },
  EnglishClubSurveyResponse: { findOne: jest.fn() },
  SurveySettings: {},
  Teacher: {},
}));

const { SurveyModuleResponse, EnglishTableSurveyResponse, EnglishClubSurveyResponse } = require('../models');
const { myStatus } = require('../services/surveyCenterService');
const surveyGatewayRouter = require('../routes/surveyGatewayRouter');
const surveyRouter = require('../routes/surveyRouter');

const PII_KEYS = ['latest', 'answersJson', 'studentName', 'studentEmail', 'metadataJson'];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/surveys', surveyRouter);
  app.use('/api/surveys', surveyGatewayRouter);
  return app;
}

describe('survey my-status minimization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('T1-P1 returns filled and the stored submittedAt', async () => {
    const submittedAt = new Date('2026-03-01T01:02:03.000Z');
    SurveyModuleResponse.findOne.mockResolvedValue({
      submittedAt,
      answersJson: { q1: 'secret' },
      studentName: '林同學',
      studentEmail: 'student@example.com',
      metadataJson: { ip: '127.0.0.1' },
    });

    const result = await myStatus({ surveyId: 'survey-a', studentId: 'B12345678' });

    expect(result).toEqual({ filled: true, submittedAt });
    expect(SurveyModuleResponse.findOne).toHaveBeenCalledWith(expect.objectContaining({
      attributes: ['submittedAt'],
      where: { surveyId: 'survey-a', studentId: 'B12345678' },
    }));
  });

  it('T1-P2 returns null submittedAt when no row exists', async () => {
    SurveyModuleResponse.findOne.mockResolvedValue(null);
    await expect(myStatus({ surveyId: 'survey-a', studentId: 'B12345678' })).resolves.toEqual({
      filled: false,
      submittedAt: null,
    });
  });

  it('T1-N1 HTTP response is limited to filled and submittedAt', async () => {
    SurveyModuleResponse.findOne.mockResolvedValue({
      submittedAt: '2026-03-01T01:02:03.000Z',
      answersJson: { q1: 'secret' },
      studentName: '林同學',
      studentEmail: 'student@example.com',
      metadataJson: { ip: '127.0.0.1' },
      latest: { answersJson: { q1: 'secret' } },
    });

    const res = await request(createApp())
      .get('/api/surveys/my-status')
      .set('Authorization', 'Bearer staff-token')
      .query({ surveyId: 'survey-a', studentId: 'B12345678' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['filled', 'submittedAt']);
    PII_KEYS.forEach((key) => {
      expect(res.body).not.toHaveProperty(key);
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(JSON.stringify(res.body)).not.toContain('student@example.com');
  });

  it('T1-N2 a staff token does not widen the payload', async () => {
    SurveyModuleResponse.findOne.mockResolvedValue({ submittedAt: null, answersJson: { hidden: true } });
    const anonymous = await request(createApp())
      .get('/api/surveys/my-status')
      .query({ surveyId: 'survey-a', studentId: 'B12345678' });
    const staff = await request(createApp())
      .get('/api/surveys/my-status')
      .set('Authorization', 'Bearer eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.')
      .query({ surveyId: 'survey-a', studentId: 'B12345678' });

    expect(anonymous.body).toEqual(staff.body);
    expect(Object.keys(staff.body).sort()).toEqual(['filled', 'submittedAt']);
  });

  it('T1-F1 rejects missing params before querying', async () => {
    const res = await request(createApp()).get('/api/surveys/my-status').query({ surveyId: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_MY_STATUS_PARAMS');
    expect(SurveyModuleResponse.findOne).not.toHaveBeenCalled();

    await expect(myStatus({ surveyId: 'survey-a' })).rejects.toMatchObject({ status: 400 });
    expect(SurveyModuleResponse.findOne).not.toHaveBeenCalled();
  });

  it('T1-F2 keeps the check endpoint contract', async () => {
    EnglishTableSurveyResponse.findOne.mockResolvedValue({ id: 1, answers: 'hidden' });
    const res = await request(createApp())
      .get('/api/surveys/check/english_table_feedback_114_1/B12345678');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['filled', 'semester']);
    expect(res.body.filled).toBe(true);
    expect(typeof res.body.semester).toBe('string');
    expect(res.body.semester.length).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty('answers');
    expect(EnglishClubSurveyResponse.findOne).not.toHaveBeenCalled();
  });

  it('T1-F3 rejects unsupported check survey ids', async () => {
    const res = await request(createApp()).get('/api/surveys/check/other_survey/B12345678');
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('UNSUPPORTED_SURVEY_TYPE');
    expect(EnglishTableSurveyResponse.findOne).not.toHaveBeenCalled();
    expect(EnglishClubSurveyResponse.findOne).not.toHaveBeenCalled();
    expect(SurveyModuleResponse.findOne).not.toHaveBeenCalled();
  });
});
