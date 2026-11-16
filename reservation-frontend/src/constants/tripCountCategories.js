export const TRIP_COUNT_CATEGORIES = [
  { code: 'meal', label: '餐費' },
  { code: 'transport', label: '交通' },
  { code: 'lodging', label: '住宿' },
  { code: 'ticket', label: '門票' },
  { code: 'other', label: '其他' },
];

export function tripCountCategoryLabel(code) {
  return TRIP_COUNT_CATEGORIES.find((item) => item.code === code)?.label || '';
}
