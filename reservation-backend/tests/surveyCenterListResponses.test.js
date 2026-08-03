/**
 * surveyCenterService.listSurveyResponses — studentEmail 篩選
 */
const { Op } = require('sequelize');

jest.mock('../models', () => ({
  sequelize: {
    literal: (sql) => ({ val: sql }),
  },
  SurveyModuleResponse: {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
  },
  SurveyResponseAnswer: { findAll: jest.fn() },
  Survey: {},
  SurveyVersion: {},
  Semester: {},
}));

const { SurveyModuleResponse, SurveyResponseAnswer } = require('../models');
const { listSurveyResponses } = require('../services/surveyCenterService');

describe('listSurveyResponses studentEmail filter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SurveyModuleResponse.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
    SurveyModuleResponse.findAll.mockResolvedValue([
      {
        totalResponses: 0,
        completedResponses: 0,
        distinctSurveyCount: 0,
        distinctEventCount: 0,
        distinctSemesterCount: 0,
      },
    ]);
    SurveyResponseAnswer.findAll.mockResolvedValue([]);
  });

  it('applies studentEmail LIKE when provided', async () => {
    await listSurveyResponses({ studentEmail: 'alice@nsysu', page: 1, pageSize: 20 });

    expect(SurveyModuleResponse.findAndCountAll).toHaveBeenCalled();
    const where = SurveyModuleResponse.findAndCountAll.mock.calls[0][0].where;
    expect(where.studentEmail).toEqual({ [Op.like]: '%alice@nsysu%' });
  });

  it('ignores empty studentEmail', async () => {
    await listSurveyResponses({ studentEmail: '   ', page: 1, pageSize: 20 });

    const where = SurveyModuleResponse.findAndCountAll.mock.calls[0][0].where;
    expect(where.studentEmail).toBeUndefined();
  });

  it('masks email in list API rows', async () => {
    SurveyModuleResponse.findAndCountAll.mockResolvedValue({
      rows: [{ id: 1, toJSON: () => ({ id: 1, studentEmail: 'alice@student.nsysu.edu.tw' }) }],
      count: 1,
    });

    const result = await listSurveyResponses({ page: 1, pageSize: 20 });
    expect(result.rows[0].studentEmail).toMatch(/\*\*\*/);
    expect(result.rows[0].studentEmail).not.toBe('alice@student.nsysu.edu.tw');
  });

  it('returns full studentEmail when __forExport', async () => {
    SurveyModuleResponse.findAndCountAll.mockResolvedValue({
      rows: [{ id: 1, toJSON: () => ({ id: 1, studentEmail: 'alice@student.nsysu.edu.tw' }) }],
      count: 1,
    });

    const result = await listSurveyResponses({ page: 1, pageSize: 20, __forExport: true });
    expect(result.rows[0].studentEmail).toBe('alice@student.nsysu.edu.tw');
  });

  it('allows pageSize up to 5000 when __forExport (not list cap 200)', async () => {
    await listSurveyResponses({ page: 1, pageSize: 5000, __forExport: true });

    const opts = SurveyModuleResponse.findAndCountAll.mock.calls[0][0];
    expect(opts.limit).toBe(5000);
  });

  it('caps list API pageSize at 200', async () => {
    await listSurveyResponses({ page: 1, pageSize: 5000 });

    const opts = SurveyModuleResponse.findAndCountAll.mock.calls[0][0];
    expect(opts.limit).toBe(200);
  });
});
