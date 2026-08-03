export const ACTIVITY_TYPE_OPTIONS = [
  { value: 'All', label: '所有活動' },
  { value: 'ET', label: 'English Table' },
  { value: 'EC', label: 'English Club' },
  { value: 'JT', label: 'Job Talk' },
  { value: 'IF', label: 'International Forum' },
];

export const SORT_OPTIONS = [
  { value: 'studentId', label: '學號' },
  { value: 'studentName', label: '姓名' },
  { value: 'attends', label: '簽到數' },
  { value: 'noShows', label: 'No-shows' },
];

export const CLASS_DETAIL_SEMESTER_OPTIONS = [
  { value: '114-1', label: '114-1學期' },
  { value: '113-2', label: '113-2學期' },
  { value: '114-2', label: '114-2學期' },
  { value: '115-1', label: '115-1學期' },
  { value: '115-2', label: '115-2學期' },
];

export function formatTotalHours(totalHours) {
  if (!totalHours) return '0';
  return totalHours.toFixed(1).replace(/\.0$/, '');
}

export function computeClassDetailStatistics(data) {
  if (!data?.length) return null;
  return {
    rosterCount: data.length,
    participatedCount: data.filter((s) => s.attendedCountTotal > 0).length,
    totalAttends: data.reduce((sum, s) => sum + s.attendedCountTotal, 0),
    totalNoShows: data.reduce((sum, s) => sum + s.noShowCount, 0),
  };
}
