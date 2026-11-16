'use strict';

const TRIP_COUNT_CATEGORIES = Object.freeze([
  { code: 'meal', label: '餐費' },
  { code: 'transport', label: '交通' },
  { code: 'lodging', label: '住宿' },
  { code: 'ticket', label: '門票' },
  { code: 'other', label: '其他' },
]);

const TRIP_COUNT_CATEGORY_CODES = new Set(TRIP_COUNT_CATEGORIES.map((item) => item.code));

function normalizeTripCountCategory(value) {
  if (value == null || String(value).trim() === '') return null;
  const code = String(value).trim();
  return TRIP_COUNT_CATEGORY_CODES.has(code) ? code : undefined;
}

module.exports = {
  TRIP_COUNT_CATEGORIES,
  TRIP_COUNT_CATEGORY_CODES,
  normalizeTripCountCategory,
};
