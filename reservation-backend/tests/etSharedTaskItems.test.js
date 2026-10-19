'use strict';

const { ET_SHARED_TASK_ITEMS } = require('../constants/etSharedTaskItems');

describe('ET shared task items', () => {
  test('uses one five-item checklist and only the first item gates pay', () => {
    expect(ET_SHARED_TASK_ITEMS).toHaveLength(5);
    expect(ET_SHARED_TASK_ITEMS.map((item) => item.code)).toEqual(['SAY', 'LINK', 'WORD', 'POINT', 'REPLY']);
    expect(ET_SHARED_TASK_ITEMS.every((item) => item.bandScope === 'ALL')).toBe(true);
    expect(ET_SHARED_TASK_ITEMS.filter((item) => item.isRequired).map((item) => item.code)).toEqual(['SAY']);
    const orders = ET_SHARED_TASK_ITEMS.map((item) => item.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});
