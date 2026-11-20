'use strict';

/**
 * 115-1 之前的培力報名在 Google 表單，english_test_registrations 沒有這些列。
 * 只放彙總筆數，不放學號或姓名。
 * 某個學期只要系統裡已有報名列（筆數大於 0），就用系統數字，不用這裡的常數蓋過。
 *
 * 填法：'114-2': 512
 */
const LEGACY_GOOGLE_FORM_REGISTRATION_COUNTS = Object.freeze({
});

function semesterSortKey(semester) {
  const value = String(semester || '').trim();
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) return value;
  return `${match[1].padStart(4, '0')}-${match[2].padStart(2, '0')}`;
}

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function buildRegistrationCountSeries(systemCounts = {}, legacyCounts = LEGACY_GOOGLE_FORM_REGISTRATION_COUNTS) {
  const bySemester = new Map();
  Object.entries(systemCounts || {}).forEach(([semester, count]) => {
    const key = String(semester || '').trim();
    const value = finiteCount(count);
    if (!key || value == null) return;
    bySemester.set(key, { semester: key, count: value, source: 'system' });
  });

  Object.entries(legacyCounts || {}).forEach(([semester, count]) => {
    const key = String(semester || '').trim();
    const value = finiteCount(count);
    if (!key || value == null || value < 0) return;
    const existing = bySemester.get(key);
    if (existing && existing.count > 0) return;
    bySemester.set(key, { semester: key, count: value, source: 'google_form' });
  });

  return [...bySemester.values()].sort((a, b) => (
    semesterSortKey(a.semester).localeCompare(semesterSortKey(b.semester), 'en')
  ));
}

module.exports = {
  LEGACY_GOOGLE_FORM_REGISTRATION_COUNTS,
  buildRegistrationCountSeries,
};
