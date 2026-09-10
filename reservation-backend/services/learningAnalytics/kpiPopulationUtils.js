'use strict';

/**
 * 從名冊年級字串解析數字年級（1–7）。
 * 支援：2、大二、二年級、Grade 2 等。
 */
function parseGradeNumber(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;

  const digit = s.match(/\d+/);
  if (digit) {
    const n = Number(digit[0]);
    if (Number.isFinite(n) && n >= 1 && n <= 7) return n;
  }

  const map = [
    [/研[一二三四五六七]|博士|碩士|graduate/i, null],
    [/大一|一年|freshman|^1\s*年級/i, 1],
    [/大二|二年|sophomore|^2\s*年級/i, 2],
    [/大三|三年|junior|^3\s*年級/i, 3],
    [/大四|四年|senior|^4\s*年級/i, 4],
    [/大五|五年|^5\s*年級/i, 5],
    [/大六|六年|^6\s*年級/i, 6],
  ];
  for (const [re, grade] of map) {
    if (re.test(s)) return grade;
  }
  return null;
}

/**
 * @param {{ gradeMin?: number|null, gradeMax?: number|null, grades?: number[]|null }} population
 */
function gradeChinese(n) {
  const map = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七' };
  return map[n] || String(n);
}

function normalizeGradeFilter(population = {}) {
  if (!population || typeof population !== 'object') {
    return { enabled: false, gradeMin: null, gradeMax: null, grades: null, label: '不限年級' };
  }

  if (Array.isArray(population.grades) && population.grades.length) {
    const grades = [...new Set(population.grades
      .map((g) => Number(g))
      .filter((g) => Number.isFinite(g) && g >= 1 && g <= 7))]
      .sort((a, b) => a - b);
    if (!grades.length) {
      return { enabled: false, gradeMin: null, gradeMax: null, grades: null, label: '不限年級' };
    }
    return {
      enabled: true,
      gradeMin: grades[0],
      gradeMax: grades[grades.length - 1],
      grades,
      label: `年級 ${grades.map((g) => `大${gradeChinese(g)}`).join('、')}`,
    };
  }

  let gradeMin = population.gradeMin != null && population.gradeMin !== ''
    ? Number(population.gradeMin)
    : null;
  let gradeMax = population.gradeMax != null && population.gradeMax !== ''
    ? Number(population.gradeMax)
    : null;
  if (gradeMin != null && !Number.isFinite(gradeMin)) gradeMin = null;
  if (gradeMax != null && !Number.isFinite(gradeMax)) gradeMax = null;
  if (gradeMin == null && gradeMax == null) {
    return { enabled: false, gradeMin: null, gradeMax: null, grades: null, label: '不限年級' };
  }
  if (gradeMin != null && gradeMax != null && gradeMin > gradeMax) {
    const tmp = gradeMin;
    gradeMin = gradeMax;
    gradeMax = tmp;
  }
  let label;
  if (gradeMin != null && gradeMax != null && gradeMin === gradeMax) {
    label = `大${gradeChinese(gradeMin)}`;
  } else if (gradeMin != null && gradeMax != null) {
    label = `大${gradeChinese(gradeMin)}至大${gradeChinese(gradeMax)}`;
  } else if (gradeMin != null) {
    label = `大${gradeChinese(gradeMin)}以上`;
  } else {
    label = `大${gradeChinese(gradeMax)}以下`;
  }
  return {
    enabled: true,
    gradeMin,
    gradeMax,
    grades: null,
    label,
  };
}

function gradeMatchesFilter(gradeRaw, filter) {
  if (!filter?.enabled) return true;
  const n = parseGradeNumber(gradeRaw);
  if (n == null) return false;
  if (Array.isArray(filter.grades) && filter.grades.length) {
    return filter.grades.includes(n);
  }
  if (filter.gradeMin != null && n < filter.gradeMin) return false;
  if (filter.gradeMax != null && n > filter.gradeMax) return false;
  return true;
}

module.exports = {
  parseGradeNumber,
  normalizeGradeFilter,
  gradeMatchesFilter,
};
