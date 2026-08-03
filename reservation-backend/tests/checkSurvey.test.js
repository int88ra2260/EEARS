// tests/checkSurvey.test.js — 僅 survey_rules 產品化 Gate

const { checkSurvey } = require('../middlewares/checkSurvey');
const { Event } = require('../models');
const { resolveGateContext, hasCompletedForGate, ruleTimeAllows } = require('../services/surveyGateService');

jest.mock('../services/surveyGateService', () => ({
  resolveGateContext: jest.fn(),
  hasCompletedForGate: jest.fn(),
  ruleTimeAllows: jest.fn(() => ({ ok: true })),
}));

jest.mock('../models', () => ({
  Event: { findByPk: jest.fn() },
}));

const productRule = {
  isEnabled: true,
  isRequired: true,
  settingsJson: null,
};

const productCtx = {
  mode: 'product',
  survey: { id: 1, name: 'ET Survey', surveyKey: 'english_table_feedback_114_1' },
  rule: productRule,
  surveyKey: 'english_table_feedback_114_1',
};

describe('checkSurvey Middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = { body: { eventId: 1, studentId: 'B123456789' } };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
    Event.findByPk.mockResolvedValue({ id: 1, eventType: 'English Table' });
    resolveGateContext.mockResolvedValue(productCtx);
    hasCompletedForGate.mockResolvedValue(false);
    ruleTimeAllows.mockReturnValue({ ok: true });
  });

  it('studentId 為空時跳過檢查', async () => {
    req.body.studentId = '';
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(resolveGateContext).not.toHaveBeenCalled();
  });

  it('無 eventId 時跳過檢查', async () => {
    delete req.body.eventId;
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(Event.findByPk).not.toHaveBeenCalled();
  });

  it('找不到活動時回 404', async () => {
    Event.findByPk.mockResolvedValue(null);
    await checkSurvey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('無產品化規則時跳過檢查', async () => {
    resolveGateContext.mockResolvedValue({ mode: 'legacy' });
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(hasCompletedForGate).not.toHaveBeenCalled();
  });

  it('規則未啟用時跳過檢查', async () => {
    resolveGateContext.mockResolvedValue({
      ...productCtx,
      rule: { ...productRule, isEnabled: false },
    });
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(hasCompletedForGate).not.toHaveBeenCalled();
  });

  it('規則尚未開始時跳過檢查', async () => {
    ruleTimeAllows.mockReturnValue({ ok: false, reason: 'not_started' });
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(hasCompletedForGate).not.toHaveBeenCalled();
  });

  it('已填寫問卷時通過', async () => {
    hasCompletedForGate.mockResolvedValue(true);
    await checkSurvey(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('未填寫問卷時回 409', async () => {
    await checkSurvey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ENGLISH_TABLE_SURVEY_REQUIRED',
        redirectUrl: '/survey/english_table_feedback_114_1',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('hasCompletedForGate 失敗時回 500', async () => {
    hasCompletedForGate.mockRejectedValue(new Error('db'));
    await checkSurvey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SURVEY_CHECK_FAILED' }));
  });
});
