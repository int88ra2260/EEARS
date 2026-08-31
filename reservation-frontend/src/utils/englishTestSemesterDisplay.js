/**
 * 將培力英檢學期代碼（如 115-1）轉為學生可讀文案。
 */
export function formatEnglishTestSemesterLabel(semester) {
  const raw = String(semester ?? '').trim();
  if (!raw) return '';

  const match = raw.match(/^(\d{3})-([12])$/);
  if (!match) return `${raw} 學期`;

  const rocYear = match[1];
  const term = match[2] === '1' ? '第 1 學期' : '第 2 學期';
  return `${rocYear} 學年${term}`;
}
