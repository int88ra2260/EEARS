import { semesterIdFromDate } from '../../utils/semesterUtils';

function parseTermSortRank(key) {
  const k = String(key || '').trim();
  if (!k || k === '未標記') return 9000;
  if (k === '畢業門檻') return 10000;

  const sem = k.match(/^(\d{3})-(\d)$/);
  if (sem) return Number(sem[1]) * 10 + Number(sem[2]);

  const sIndex = k.match(/^S(\d+)$/i);
  if (sIndex) return 3000 + Number(sIndex[1]);

  return 8000;
}

export function compareTermKeys(a, b) {
  const diff = parseTermSortRank(a) - parseTermSortRank(b);
  if (diff !== 0) return diff;
  return String(a).localeCompare(String(b), 'zh-TW');
}

/**
 * 決定事件落在哪個學期欄位（僅學期代碼，不使用 YYYY-MM 日期欄）。
 */
export function resolveEventColumnKey(event, enrollmentTerm) {
  const termLabel = String(event?.termLabel || '').trim();
  if (/^\d{3}-\d$/.test(termLabel)) return termLabel;

  if (event?.lane === 'baseline' && enrollmentTerm) return enrollmentTerm;

  if (event?.eventDate) {
    const fromDate = semesterIdFromDate(event.eventDate);
    if (fromDate) return fromDate;
  }

  const academicTerm = String(event?.academicTerm || '').trim();
  if (/^\d{3}-\d$/.test(academicTerm)) return academicTerm;

  return '未標記';
}

export function formatColumnLabel(key, enrollmentTerm) {
  if (key === '畢業門檻') return '畢業門檻';
  if (key === '未標記') return '未標記學期';
  if (enrollmentTerm && key === enrollmentTerm) return `${key}（入學）`;
  return key;
}

/**
 * @returns {{ key: string, label: string, isMilestone: boolean }[]}
 */
export function buildTimelineColumns(timeline, enrollmentTerm) {
  const keys = new Set();
  for (const ev of timeline || []) {
    keys.add(resolveEventColumnKey(ev, enrollmentTerm));
  }

  if (enrollmentTerm) keys.add(enrollmentTerm);

  const sorted = [...keys]
    .filter((k) => k !== '畢業門檻' && k !== '未標記')
    .sort(compareTermKeys);

  const columns = sorted.map((key) => ({
    key,
    label: formatColumnLabel(key, enrollmentTerm),
    isMilestone: false,
  }));

  if (keys.has('未標記')) {
    columns.push({
      key: '未標記',
      label: formatColumnLabel('未標記', enrollmentTerm),
      isMilestone: false,
    });
  }

  columns.push({
    key: '畢業門檻',
    label: '畢業門檻',
    isMilestone: true,
  });

  return columns;
}

export const TIMELINE_LANES = ['baseline', 'exam', 'course', 'activity'];

/**
 * @returns {Record<string, Record<string, object[]>>}
 */
export function buildLaneColumnGroups(byLane, columns, enrollmentTerm, groupFn) {
  const result = {};
  const columnKeys = columns.map((c) => c.key);

  for (const lane of TIMELINE_LANES) {
    const buckets = Object.fromEntries(columnKeys.map((k) => [k, []]));

    for (const ev of byLane[lane] || []) {
      const colKey = resolveEventColumnKey(ev, enrollmentTerm);
      const bucketKey = columnKeys.includes(colKey) ? colKey : '未標記';
      if (!buckets[bucketKey]) buckets[bucketKey] = [];
      buckets[bucketKey].push(ev);
    }

    result[lane] = Object.fromEntries(
      columnKeys.map((key) => [key, groupFn(buckets[key] || [], lane)])
    );
  }

  return result;
}
