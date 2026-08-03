jest.mock('../../services/surveyGateService', () => ({
  resolveGateContext: jest.fn(),
  hasCompletedForGate: jest.fn(),
  ruleTimeAllows: jest.fn(() => ({ ok: true })),
}));

jest.mock('../../models', () => ({
  Event: { findByPk: jest.fn() },
}));

const { checkSurvey } = require('../../middlewares/checkSurvey');
const { Event } = require('../../models');
const { resolveGateContext, hasCompletedForGate } = require('../../services/surveyGateService');

function runMiddleware(reqBody) {
  const req = { body: reqBody, originalUrl: '/api/reservations', requestId: 'test-rid' };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
  const next = jest.fn();
  return checkSurvey(req, res, next).then(() => ({ res, next }));
}

const productCtx = {
  mode: 'product',
  survey: { id: 1, name: 'ET', surveyKey: 'english_table_feedback_114_1' },
  rule: { isEnabled: true, isRequired: true },
  surveyKey: 'english_table_feedback_114_1',
};

describe('survey gate fail-close behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Event.findByPk.mockResolvedValue({ id: 1, eventType: 'English Table' });
    resolveGateContext.mockResolvedValue(productCtx);
    hasCompletedForGate.mockResolvedValue(false);
  });

  it('required survey missing -> blocked', async () => {
    const { res, next } = await runMiddleware({ eventId: 1, studentId: 'B123456789' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('ENGLISH_TABLE_SURVEY_REQUIRED');
  });

  it('survey check database error -> blocked', async () => {
    hasCompletedForGate.mockRejectedValue(new Error('db down'));
    const { res, next } = await runMiddleware({ eventId: 1, studentId: 'B123456789' });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.payload.code).toBe('SURVEY_CHECK_FAILED');
  });

  it('fake client eventType -> ignored, still blocked by DB eventType', async () => {
    const { res } = await runMiddleware({
      eventId: 1,
      studentId: 'B123456789',
      eventType: 'Job Talk',
    });
    expect(Event.findByPk).toHaveBeenCalledWith(1, { attributes: ['id', 'eventType'] });
    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('ENGLISH_TABLE_SURVEY_REQUIRED');
  });

  it('non-survey event -> allowed', async () => {
    Event.findByPk.mockResolvedValue({ id: 2, eventType: 'International Forum' });
    resolveGateContext.mockResolvedValue({ mode: 'legacy' });
    const { res, next } = await runMiddleware({ eventId: 2, studentId: 'B123456789' });
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
