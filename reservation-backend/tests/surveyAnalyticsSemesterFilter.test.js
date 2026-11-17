'use strict';

jest.mock('../models', () => ({
  sequelize: { literal: (sql) => ({ val: sql }) },
  SurveyModuleResponse: { findAll: jest.fn(), count: jest.fn() },
  SurveyResponseAnswer: { findAll: jest.fn() },
  Survey: {},
  SurveyVersion: { findByPk: jest.fn() },
  SurveyRule: {},
  Semester: { findByPk: jest.fn() },
  Event: { findAll: jest.fn() },
}));

const { Op } = require('sequelize');
const { Semester } = require('../models');
const { applyResponseListFilters, buildAnalyticsWhere } = require('../services/surveyCenterService');

describe('analytics semester filter', () => {
  beforeEach(() => {
    Semester.findByPk.mockReset();
  });

  it('matches responses that only stored the semester code', async () => {
    Semester.findByPk.mockResolvedValue({ id: 4, code: '115-1' });
    const analyticsWhere = await buildAnalyticsWhere({ semesterId: '4', surveyId: 9 });
    const listWhere = await applyResponseListFilters({ semesterId: '4', surveyId: 9 });
    expect(analyticsWhere).toEqual(listWhere);
    expect(analyticsWhere[Op.and][0][Op.or]).toEqual([
      { semesterId: 4 },
      { semester: '115-1' },
    ]);
  });

  it('treats ET as English Table, the same way as the response list', async () => {
    const analyticsWhere = await buildAnalyticsWhere({ activityType: 'ET' });
    const listWhere = await applyResponseListFilters({ activityType: 'ET' });
    expect(analyticsWhere).toEqual(listWhere);
    expect(analyticsWhere[Op.and][0][Op.or]).toEqual([
      { activityType: 'English Table' },
      { activityType: 'ET' },
      { eventType: 'English Table' },
    ]);
  });
});
