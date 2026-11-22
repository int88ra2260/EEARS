export const KPI_DETAIL_PAGE_SIZES = [50, 100, 200];

function text(value) {
  return String(value || '').trim();
}

function gradeRank(row) {
  const raw = row?.gradeNo;
  if (raw != null && raw !== '') {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return numeric;
  }
  const label = text(row?.grade);
  const named = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  for (const [ch, rank] of Object.entries(named)) {
    if (label.includes(ch)) return rank;
  }
  return /^\d+$/.test(label) ? Number(label) : null;
}

function compareText(left, right) {
  return text(left).localeCompare(text(right), 'zh-Hant', { numeric: true, sensitivity: 'base' });
}

function compareWithEmptyLast(left, right, compare) {
  const leftEmpty = left == null || left === '';
  const rightEmpty = right == null || right === '';
  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;
  return compare(left, right);
}

function dimensionPassed(row, dimensionId) {
  return Boolean(row?.dimensions?.[dimensionId]?.passed);
}

function matchesAttainment(row, attainment, dimensions) {
  const dims = dimensions || [];
  if (!attainment || attainment === 'all') return true;
  if (attainment === 'passed') {
    return dims.length > 0 && dims.every((dim) => dimensionPassed(row, dim.id));
  }
  if (attainment === 'unmet') {
    return dims.length > 0 && dims.some((dim) => !dimensionPassed(row, dim.id));
  }
  const match = /^dim:(.+):(Y|N)$/.exec(attainment);
  if (!match) return true;
  const passed = dimensionPassed(row, match[1]);
  return match[2] === 'Y' ? passed : !passed;
}

export function kpiDetailFilterOptions(rows) {
  const grades = new Map();
  const departments = new Set();
  for (const row of rows || []) {
    const grade = text(row?.grade);
    if (grade && !grades.has(grade)) grades.set(grade, gradeRank(row));
    const department = text(row?.department);
    if (department) departments.add(department);
  }
  return {
    grades: [...grades.entries()]
      .sort((a, b) => compareWithEmptyLast(a[1], b[1], (left, right) => left - right)
        || compareText(a[0], b[0]))
      .map(([label]) => label),
    departments: [...departments].sort(compareText),
  };
}

export function filterKpiDetailRows(rows, filters = {}, dimensions = []) {
  const keyword = text(filters.keyword).toUpperCase();
  const grade = text(filters.grade);
  const department = text(filters.department);
  const attainment = filters.attainment || 'all';
  return (rows || []).filter((row) => {
    if (keyword && !text(row?.studentId).toUpperCase().includes(keyword)) return false;
    if (grade && text(row?.grade) !== grade) return false;
    if (department && text(row?.department) !== department) return false;
    return matchesAttainment(row, attainment, dimensions);
  });
}

function sortValue(row, sortKey) {
  if (sortKey === 'grade') return gradeRank(row);
  if (sortKey === 'department') return text(row?.department) || null;
  if (String(sortKey || '').startsWith('dim:')) {
    return dimensionPassed(row, String(sortKey).slice(4)) ? 1 : 0;
  }
  return text(row?.studentId) || null;
}

export function sortKpiDetailRows(rows, sortKey = 'studentId', sortDir = 'asc') {
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...(rows || [])].sort((left, right) => {
    const a = sortValue(left, sortKey);
    const b = sortValue(right, sortKey);
    if (a == null && b == null) return compareText(left?.studentId, right?.studentId);
    if (a == null) return 1;
    if (b == null) return -1;
    const compared = typeof a === 'number' && typeof b === 'number' ? a - b : compareText(a, b);
    if (compared !== 0) return compared * dir;
    return compareText(left?.studentId, right?.studentId);
  });
}

export function pageKpiDetailRows(rows, page = 1, pageSize = 50) {
  const size = KPI_DETAIL_PAGE_SIZES.includes(pageSize) ? pageSize : 50;
  const total = (rows || []).length;
  const pageCount = Math.max(1, Math.ceil(total / size) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * size;
  return {
    page: safePage,
    pageSize: size,
    pageCount,
    total,
    start,
    rows: (rows || []).slice(start, start + size),
  };
}
