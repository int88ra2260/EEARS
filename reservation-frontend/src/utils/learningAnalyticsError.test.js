import { describe, expect, test } from 'vitest';
import { presentLearningAnalyticsError } from './learningAnalyticsError';

const RAW = "Table 'activity_reservation.lj_analytic_students' doesn't exist";

describe('presentLearningAnalyticsError', () => {
  test('hides a raw database failure', () => {
    const text = presentLearningAnalyticsError({ status: 500, message: RAW });
    expect(text).toContain('目前無法取得學習分析資料');
    expect(text).not.toContain('lj_analytic_students');
    expect(text).toContain('聯絡系統管理員');
  });

  test('keeps auth, permission, missing data, and rate limits distinct', () => {
    expect(presentLearningAnalyticsError({ status: 401, message: RAW })).toContain('重新登入');
    expect(presentLearningAnalyticsError({ status: 403, message: RAW })).toBe('您沒有執行此操作的權限。');
    expect(presentLearningAnalyticsError({ status: 404, message: 'missing' })).toContain('找不到');
    expect(presentLearningAnalyticsError({ status: 429, message: 'slow' })).toContain('過於頻繁');
  });

  test('keeps a safe validation message', () => {
    expect(presentLearningAnalyticsError({ status: 400, message: '請選擇學期' })).toBe('請選擇學期');
  });
});
