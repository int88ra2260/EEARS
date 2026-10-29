'use strict';

const {
  publicMessage,
  sendAnalyticsError,
  statusFromValidationMessage,
} = require('../services/learningAnalytics/learningAnalyticsClientError');

describe('learning analytics client errors', () => {
  test('keeps a validation message on 400', () => {
    expect(statusFromValidationMessage('請提供至少一筆 profiles')).toBe(400);
    expect(statusFromValidationMessage('請提供至少一項 LVA 參數')).toBe(400);
    expect(statusFromValidationMessage(rawDb())).toBe(500);
    expect(publicMessage({ message: '請提供至少一筆 profiles' }, 400)).toBe('請提供至少一筆 profiles');
    expect(publicMessage({ message: '學期必填' }, 400)).toBe('學期必填');
  });

  test('does not return a database message for 500', () => {
    const raw = "Table 'activity_reservation.lj_analytic_students' doesn't exist";
    expect(publicMessage({ message: raw }, 500)).not.toContain('lj_analytic_students');
    expect(publicMessage({ message: raw }, 500)).toContain('目前無法取得學習分析資料');
  });

  test('distinguishes auth and permission from a server failure', () => {
    expect(publicMessage({ message: rawDb() }, 401)).toContain('重新登入');
    expect(publicMessage({ message: 'forbidden' }, 403)).toContain('沒有檢視');
    expect(publicMessage({ message: 'missing' }, 404)).toContain('找不到');
    expect(publicMessage({ message: 'slow down' }, 429)).toContain('過於頻繁');
  });

  test('response body omits the database text and still records a server log', () => {
    const logs = [];
    const logger = require('../utils/logger');
    const spy = jest.spyOn(logger, 'error').mockImplementation((message) => {
      logs.push(message);
    });
    const raw = "Table 'activity_reservation.lj_analytic_students' doesn't exist";
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const error = new Error(raw);
    error.name = 'SequelizeDatabaseError';
    error.parent = { code: 'ER_NO_SUCH_TABLE', sql: 'SELECT secret FROM lj_analytic_students' };

    sendAnalyticsError({ requestId: 'rid-1' }, res, error);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.code).toBe('LEARNING_ANALYTICS_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('lj_analytic_students');
    expect(JSON.stringify(body)).not.toContain('SELECT');
    expect(logs[0]).toContain('rid-1');
    spy.mockRestore();
  });
});

function rawDb() {
  return "Table 'activity_reservation.lj_analytic_students' doesn't exist";
}
