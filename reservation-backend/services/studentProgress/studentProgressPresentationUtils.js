'use strict';

const EXAM_TYPE_ORDER = { LR: 1, SW: 2, L: 3, R: 4, S: 5, W: 6 };

/**
 * 正規化班級名稱以便合併「同名不同班」匯入紀錄。
 */
function normalizeCourseTitle(className) {
  if (!className) return '';
  let title = String(className).trim();
  title = title.replace(/\b[A-Z]{2,}\d{2,}[A-Z0-9]*\b/gi, ' ');
  const parenCount = (title.match(/[（(][^）)]+[）)]/gu) || []).length;
  if (parenCount >= 2) {
    title = title.replace(/[（(][^）)]+[）)]\s*$/u, '').trim();
  }
  title = title.replace(/\s+/g, ' ').trim();
  return title.toLowerCase();
}

function courseRecordKey(item) {
  return `${item.semester || ''}::${normalizeCourseTitle(item.className)}`;
}

/**
 * 同一學期、同一課名（正規化後）只保留一筆；顯示較完整的班級名稱。
 */
function dedupeCourseRecords(items = []) {
  const map = new Map();

  for (const item of items) {
    if (!item.semester || !normalizeCourseTitle(item.className)) {
      continue;
    }
    const key = courseRecordKey(item);

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item });
      continue;
    }

    const existingName = String(existing.className || '');
    const nextName = String(item.className || '');
    const preferred = nextName.length > existingName.length ? item : existing;
    const fallback = preferred === item ? existing : item;

    map.set(key, {
      semester: preferred.semester,
      className: preferred.className || fallback.className,
      department: preferred.department || fallback.department || null,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const semCmp = String(b.semester).localeCompare(String(a.semester));
    if (semCmp !== 0) return semCmp;
    return String(a.className || '').localeCompare(String(b.className || ''), 'zh-Hant');
  });
}

/**
 * 同一學期只保留一筆成績（已按 importedAt 新到舊排序時取第一筆）。
 */
function dedupeBestepScoresBySemester(rows = []) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    if (!row.semester || seen.has(row.semester)) continue;
    seen.add(row.semester);
    result.push(row);
  }
  return result;
}

/**
 * 有 LR / SW 組合列時，隱藏對應的 L/R、S/W 單項列，避免學生端看見 6 筆重複語意。
 */
function compactBestepAttendance(rows = []) {
  const bySemester = new Map();

  for (const row of rows) {
    if (!row.semester) continue;
    if (!bySemester.has(row.semester)) bySemester.set(row.semester, []);
    bySemester.get(row.semester).push(row);
  }

  const result = [];
  for (const group of bySemester.values()) {
    const types = new Set(group.map((r) => r.examType));
    const hide = new Set();
    if (types.has('LR')) {
      hide.add('L');
      hide.add('R');
    }
    if (types.has('SW')) {
      hide.add('S');
      hide.add('W');
    }

    const filtered = group
      .filter((r) => !hide.has(r.examType))
      .sort((a, b) => (EXAM_TYPE_ORDER[a.examType] || 99) - (EXAM_TYPE_ORDER[b.examType] || 99));

    result.push(...filtered);
  }

  return result.sort((a, b) => {
    const semCmp = String(b.semester).localeCompare(String(a.semester));
    if (semCmp !== 0) return semCmp;
    return (EXAM_TYPE_ORDER[a.examType] || 99) - (EXAM_TYPE_ORDER[b.examType] || 99);
  });
}

/**
 * 同一學期英檢報名只保留最新一筆。
 */
function dedupeEnglishTestRegistrations(rows = []) {
  const bySemester = new Map();

  for (const row of rows) {
    const key = row.semester || '_null';
    const existing = bySemester.get(key);
    if (!existing) {
      bySemester.set(key, row);
      continue;
    }
    const existingTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
    const nextTs = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    if (nextTs >= existingTs) {
      bySemester.set(key, row);
    }
  }

  return Array.from(bySemester.values()).sort((a, b) => {
    const semA = a.semester || '';
    const semB = b.semester || '';
    return semB.localeCompare(semA);
  });
}

module.exports = {
  normalizeCourseTitle,
  dedupeCourseRecords,
  dedupeBestepScoresBySemester,
  compactBestepAttendance,
  dedupeEnglishTestRegistrations,
};
