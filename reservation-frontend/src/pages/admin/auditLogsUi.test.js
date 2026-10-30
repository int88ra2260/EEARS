import { describe, expect, test } from 'vitest';
import {
  actionLabel,
  addDaysToDateInput,
  buildListParams,
  buildRequestTimeline,
  describeAppliedFilters,
  formatLogTime,
  pageRangeLabel,
  pageWindow,
  requestGapLabels,
  statusLabel,
  statusTone,
} from './auditLogsUi';

describe('操作紀錄呈現', () => {
  test('查詢參數會依紀錄類型對應，並略過空白條件', () => {
    expect(buildListParams('audit', {
      action: 'login_failure',
      actionMatchExact: true,
      keyword: '  ',
      moduleName: 'auth',
    }, 1, 50)).toEqual({
      page: 1,
      limit: 50,
      module: 'auth',
      action: 'login_failure',
      actionMode: 'exact',
    });

    expect(buildListParams('system', { onlyServerErrors: true, status: '404' }, 2, 20)).toEqual({
      page: 2,
      limit: 20,
      statusMin: 500,
      statusMax: 599,
    });
  });

  test('狀態、操作名稱與時間用可掃讀的中文', () => {
    expect(statusTone('failed')).toBe('bad');
    expect(statusTone('404')).toBe('warn');
    expect(statusTone(200)).toBe('ok');
    expect(statusLabel('retry')).toBe('重試');
    expect(actionLabel('login_failure')).toBe('登入失敗');
    expect(actionLabel('student_login_success')).toBe('學生登入成功');
    expect(actionLabel('student_allocation_saved')).toBe('學生儲存課堂加分');
    expect(actionLabel('custom_action')).toBe('custom_action');

    const when = formatLogTime('2026-10-29T12:00:00.000Z', new Date('2026-10-29T12:10:00.000Z'));
    expect(when.relative).toBe('10 分鐘前');
    expect(when.clock).not.toBe('—');
  });

  test('已套用條件、分頁與同一請求的時間序', () => {
    expect(describeAppliedFilters('audit', {
      action: 'login_failure',
      actionMatchExact: true,
      dateFrom: '2026-10-01',
    })).toEqual(['做了什麼：登入失敗，名稱要完全一樣', '2026-10-01 至 不限']);

    expect(addDaysToDateInput('2026-03-01', -1)).toBe('2026-02-28');
    expect(pageRangeLabel(2, 50, 120)).toBe('第 51–100 筆，共 120 筆');
    expect(pageWindow(5, 10)).toEqual([1, 'gap-start', 3, 4, 5, 6, 7, 'gap-end', 10]);

    const payload = {
      systemLogs: [{ id: 2, createdAt: '2026-10-29T12:00:02.000Z' }],
      auditLogs: [{ id: 1, createdAt: '2026-10-29T12:00:01.000Z' }],
      emailLogs: [],
    };
    expect(buildRequestTimeline(payload).map((item) => item.id)).toEqual(['audit-1', 'http-2']);
    expect(requestGapLabels(payload)).toEqual(['寄出的信']);
  });
});
