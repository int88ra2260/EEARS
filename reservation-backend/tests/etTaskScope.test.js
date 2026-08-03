'use strict';

const {
  taskAppliesToBand,
  filterTasksForBand,
  isMarkingWindowOpen,
} = require('../services/etGrouping/etTaskScope');

describe('etTaskScope', () => {
  const baseItem = (overrides = {}) => ({
    id: 1,
    code: 'ATTEND',
    label: '簽到',
    bandScope: 'ALL',
    sortOrder: 10,
    isRequired: true,
    isActive: true,
    ...overrides,
  });

  it('applies ALL scope to any band', () => {
    expect(taskAppliesToBand(baseItem(), 'ET-B1')).toBe(true);
    expect(taskAppliesToBand(baseItem(), 'ET-UNK')).toBe(true);
  });

  it('filters band-specific tasks', () => {
    const items = [
      baseItem({ id: 1, bandScope: 'ALL' }),
      baseItem({ id: 2, code: 'A2_VOCAB', bandScope: 'ET-A2' }),
      baseItem({ id: 3, code: 'B1_REASON', bandScope: 'B1_PLUS' }),
    ];
    const a2 = filterTasksForBand(items, 'ET-A2');
    expect(a2.map((t) => t.code)).toEqual(['ATTEND', 'A2_VOCAB']);

    const b1 = filterTasksForBand(items, 'ET-B1');
    expect(b1.map((t) => t.code)).toEqual(['ATTEND', 'B1_REASON']);
  });

  it('checks marking window with grace days', () => {
    const event = { date: '2026-07-10', endTime: '12:00' };
    const beforeDeadline = new Date('2026-07-12T10:00:00+08:00');
    const afterDeadline = new Date('2026-07-14T10:00:00+08:00');
    expect(isMarkingWindowOpen(event, { now: beforeDeadline, graceDays: 3 })).toBe(true);
    expect(isMarkingWindowOpen(event, { now: afterDeadline, graceDays: 3 })).toBe(false);
  });
});
