import {
  buildEventSummaryDateParams,
  normalizeDateRange,
  resolveDateFilterPreset,
  filterSummaryByDateParams,
} from './adminEventSummaryDateFilter';

describe('adminEventSummaryDateFilter', () => {
  test('單日模式只帶 date', () => {
    expect(buildEventSummaryDateParams({
      mode: 'single',
      date: '2026-07-24',
    })).toEqual({ date: '2026-07-24' });
  });

  test('區間模式帶 dateFrom/dateTo', () => {
    expect(buildEventSummaryDateParams({
      mode: 'range',
      dateFrom: '2026-07-20',
      dateTo: '2026-07-24',
    })).toEqual({
      dateFrom: '2026-07-20',
      dateTo: '2026-07-24',
    });
  });

  test('區間起迄顛倒會自動對調', () => {
    expect(normalizeDateRange('2026-07-24', '2026-07-20')).toEqual({
      from: '2026-07-20',
      to: '2026-07-24',
    });
  });

  test('清空日期時不帶參數', () => {
    expect(buildEventSummaryDateParams({ mode: 'single', date: '' })).toEqual({
      date: undefined,
    });
    expect(buildEventSummaryDateParams({ mode: 'range' })).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  test('今日：切到單日並同步所有日期欄位', () => {
    expect(resolveDateFilterPreset('today', '2026-07-24')).toEqual({
      mode: 'single',
      filterDate: '2026-07-24',
      filterDateFrom: '2026-07-24',
      filterDateTo: '2026-07-24',
      dateParams: { date: '2026-07-24' },
    });
  });

  test('近7天：切到區間並同步單日欄位', () => {
    expect(resolveDateFilterPreset('week', '2026-07-24')).toEqual({
      mode: 'range',
      filterDate: '2026-07-24',
      filterDateFrom: '2026-07-18',
      filterDateTo: '2026-07-24',
      dateParams: {
        dateFrom: '2026-07-18',
        dateTo: '2026-07-24',
      },
    });
  });

  test('不限日期：清空日期、保留模式', () => {
    expect(resolveDateFilterPreset('clear', '2026-07-24')).toEqual({
      mode: null,
      filterDate: '',
      filterDateFrom: '',
      filterDateTo: '',
      dateParams: {},
    });
  });

  test('前端防護：近7天不可顯示區間外活動', () => {
    const rows = [
      { eventId: 1, date: '2026-03-09' },
      { eventId: 2, date: '2026-07-20' },
      { eventId: 3, date: '2026-07-25' },
    ];
    const filtered = filterSummaryByDateParams(rows, {
      dateFrom: '2026-07-18',
      dateTo: '2026-07-24',
    });
    expect(filtered.map((r) => r.eventId)).toEqual([2]);
  });
});
