'use strict';

const { normalizeExamTypeCode } = require('../utils/englishTestExamType');

const SKILLS = [
  { key: 'listening', code: 'L', label: '聽力', scoreField: 'listeningScore', levelField: 'listeningLevel', fullMarks: [40, 40, 60] },
  { key: 'reading', code: 'R', label: '閱讀', scoreField: 'readingScore', levelField: 'readingLevel', fullMarks: [20, 60, 60] },
  { key: 'speaking', code: 'S', label: '口說', scoreField: 'speakingScore', levelField: 'speakingLevel', fullMarks: [80, 130, 150] },
  { key: 'writing', code: 'W', label: '寫作', scoreField: 'writingScore', levelField: 'writingLevel', fullMarks: [80, 130, 150] },
];

const PART_LABELS = ['第一部分', '第二部分', '第三部分'];

const COMPARISON_NOTE = '各部分滿分不同，弱項用達成率比較。這是各次考試或這批學生的描述，不能當成教學造成成績上升的證明。';
const HISTORY_NOTE = '各次考試各自計算平均達成率。同一人可以出現在多次考試，人數不加總。總分為 0 且 CEFR 空白的列是未作答，不計入。沒有部分分數的列不計入。';
const PRE_EXAM_NOTE = '母體是這學期報名成功、且有應考項目的學生。細項用他們最近一次更早的培力成績，不含本學期這一梯。只計算該生這次有報考的技能。';
const APPROACHING_NOTE = '依該科自己的 CEFR 圈出 B1 與 B1+，看這一梯還沒到 B2 的人哪一部分較弱。更早匯入、加號已被拿掉的列會落在 B1，無法再拆成 B1+。未作答與沒有部分分數的列不計入。';

const PART_SCORE_ATTRIBUTES = SKILLS.flatMap((skill) => [
  `${skill.key}AchievementRate`,
  `${skill.key}Part1Score`,
  `${skill.key}Part1Rate`,
  `${skill.key}Part2Score`,
  `${skill.key}Part2Rate`,
  `${skill.key}Part3Score`,
  `${skill.key}Part3Rate`,
]);

function trimText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function foldStudentKey(studentId) {
  const raw = trimText(studentId);
  if (!raw) return null;
  return raw.toUpperCase();
}

function semesterSortKey(semester) {
  const value = trimText(semester);
  const match = value.match(/^(\d+)-(\d+)$/);
  if (!match) return value;
  return `${match[1].padStart(4, '0')}-${match[2].padStart(2, '0')}`;
}

function parseStoredScore(value) {
  if (value == null) return null;
  if (typeof value === 'string' && trimText(value) === '') return null;
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function isSuccessStatus(status) {
  const value = trimText(status).toLowerCase();
  return value === 'success' || value === 'registered_success';
}

function componentsForExamType(examType) {
  const code = normalizeExamTypeCode(examType);
  if (code === 'LRSW') return ['L', 'R', 'S', 'W'];
  if (code === 'LR') return ['L', 'R'];
  if (code === 'SW') return ['S', 'W'];
  return [];
}

function meanRate(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function partRate(row, skill, partIndex) {
  const part = partIndex + 1;
  const storedRate = parseStoredScore(row[`${skill.key}Part${part}Rate`]);
  if (storedRate != null) return storedRate;
  const score = parseStoredScore(row[`${skill.key}Part${part}Score`]);
  if (score == null) return null;
  return (score / skill.fullMarks[partIndex]) * 100;
}

function skillAttempted(row, skill) {
  if (trimText(row[skill.levelField])) return true;
  const score = parseStoredScore(row[skill.scoreField]);
  return score != null && score !== 0;
}

function markWeakest(parts) {
  const usable = parts.filter((part) => part.count > 0 && part.meanRate != null);
  const lowest = usable.length ? Math.min(...usable.map((part) => part.meanRate)) : null;
  return parts.map((part) => ({
    ...part,
    weakest: lowest != null && part.count > 0 && part.meanRate === lowest,
  }));
}

function partShell(skill, partIndex) {
  return {
    skill: skill.key,
    skillLabel: skill.label,
    part: partIndex + 1,
    label: `${skill.label}${PART_LABELS[partIndex]}`,
    fullMark: skill.fullMarks[partIndex],
  };
}

function collectSemesters(scores) {
  const semesters = new Set();
  (scores || []).forEach((row) => {
    const value = trimText(row && row.semester);
    if (value && value !== 'null') semesters.add(value);
  });
  return [...semesters].sort((left, right) => semesterSortKey(left).localeCompare(semesterSortKey(right), 'en'));
}

function buildHistory(scores) {
  const semesters = collectSemesters(scores);
  const parts = [];
  SKILLS.forEach((skill) => {
    const built = skill.fullMarks.map((fullMark, partIndex) => {
      const bySemester = {};
      semesters.forEach((semester) => {
        const rates = [];
        (scores || []).forEach((row) => {
          if (trimText(row.semester) !== semester) return;
          if (!skillAttempted(row, skill)) return;
          const rate = partRate(row, skill, partIndex);
          if (rate == null) return;
          rates.push(rate);
        });
        bySemester[semester] = { count: rates.length, meanRate: meanRate(rates) };
      });
      return {
        ...partShell(skill, partIndex),
        fullMark,
        bySemester,
      };
    });
    semesters.forEach((semester) => {
      const cells = built.map((part) => part.bySemester[semester]);
      const usable = cells.filter((cell) => cell.count > 0 && cell.meanRate != null);
      const lowest = usable.length ? Math.min(...usable.map((cell) => cell.meanRate)) : null;
      built.forEach((part) => {
        const cell = part.bySemester[semester];
        cell.weakest = lowest != null && cell.count > 0 && cell.meanRate === lowest;
      });
    });
    parts.push(...built);
  });
  return {
    sumsPeople: false,
    note: HISTORY_NOTE,
    semesters,
    parts,
  };
}

function indexRawIds(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const raw = trimText(row.studentId);
    const key = foldStudentKey(raw);
    if (!key) return;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(raw);
  });
  return map;
}

function ambiguousKeys(rows) {
  const keys = new Set();
  indexRawIds(rows).forEach((ids, key) => {
    if (ids.size > 1) keys.add(key);
  });
  return keys;
}

function emptyScoped(status, semester, note) {
  return {
    status,
    semester: semester || 'all',
    note,
    registeredStudentCount: null,
    withPriorParts: null,
    withoutPriorParts: null,
    parts: [],
  };
}

function buildPreExam(semester, registrations, scores) {
  const requested = trimText(semester) || 'all';
  if (requested === 'all') return emptyScoped('needs_single_semester', requested, PRE_EXAM_NOTE);

  const regRows = (registrations || []).filter((row) => trimText(row.semester) === requested);
  const ambiguous = new Set([
    ...ambiguousKeys(regRows),
    ...ambiguousKeys(scores),
  ]);
  const targetKey = semesterSortKey(requested);
  const eligible = new Map();
  regRows.forEach((row) => {
    if (!isSuccessStatus(row.status)) return;
    const key = foldStudentKey(row.studentId);
    if (!key || ambiguous.has(key)) return;
    const skills = componentsForExamType(row.examType);
    if (!skills.length) return;
    if (!eligible.has(key)) eligible.set(key, new Set());
    skills.forEach((code) => eligible.get(key).add(code));
  });

  const prior = new Map();
  (scores || []).forEach((row) => {
    const key = foldStudentKey(row.studentId);
    if (!key || ambiguous.has(key)) return;
    const rowSemester = trimText(row.semester);
    if (!rowSemester || semesterSortKey(rowSemester) >= targetKey) return;
    const current = prior.get(key);
    if (!current || semesterSortKey(rowSemester) > semesterSortKey(trimText(current.semester))) {
      prior.set(key, row);
    }
  });

  const buckets = SKILLS.map((skill) => skill.fullMarks.map(() => []));
  let withPriorParts = 0;
  eligible.forEach((skillCodes, key) => {
    const row = prior.get(key);
    let used = false;
    SKILLS.forEach((skill, skillIndex) => {
      if (!skillCodes.has(skill.code) || !row || !skillAttempted(row, skill)) return;
      skill.fullMarks.forEach((_, partIndex) => {
        const rate = partRate(row, skill, partIndex);
        if (rate == null) return;
        buckets[skillIndex][partIndex].push(rate);
        used = true;
      });
    });
    if (used) withPriorParts += 1;
  });

  const parts = [];
  SKILLS.forEach((skill, skillIndex) => {
    const built = skill.fullMarks.map((fullMark, partIndex) => ({
      ...partShell(skill, partIndex),
      fullMark,
      count: buckets[skillIndex][partIndex].length,
      meanRate: meanRate(buckets[skillIndex][partIndex]),
    }));
    parts.push(...markWeakest(built));
  });

  return {
    status: 'ready',
    semester: requested,
    note: PRE_EXAM_NOTE,
    registeredStudentCount: eligible.size,
    withPriorParts,
    withoutPriorParts: eligible.size - withPriorParts,
    parts,
  };
}

function buildApproaching(semester, scores) {
  const requested = trimText(semester) || 'all';
  if (requested === 'all') {
    return { status: 'needs_single_semester', semester: requested, note: APPROACHING_NOTE, skills: [] };
  }
  const rows = (scores || []).filter((row) => trimText(row.semester) === requested);
  const anyPart = rows.some((row) => SKILLS.some((skill) => (
    skill.fullMarks.some((_, partIndex) => partRate(row, skill, partIndex) != null)
  )));
  const skills = SKILLS.map((skill) => {
    const groups = ['B1', 'B1+', 'B1與B1+'].map((level) => {
      const matched = rows.filter((row) => {
        if (!skillAttempted(row, skill)) return false;
        const stored = trimText(row[skill.levelField]).toUpperCase();
        const inGroup = level === 'B1與B1+'
          ? stored === 'B1' || stored === 'B1+'
          : stored === level;
        if (!inGroup) return false;
        return skill.fullMarks.some((_, partIndex) => partRate(row, skill, partIndex) != null);
      });
      const parts = markWeakest(skill.fullMarks.map((fullMark, partIndex) => {
        const rates = [];
        matched.forEach((row) => {
          const rate = partRate(row, skill, partIndex);
          if (rate != null) rates.push(rate);
        });
        return {
          part: partIndex + 1,
          label: PART_LABELS[partIndex],
          fullMark,
          count: rates.length,
          meanRate: meanRate(rates),
        };
      }));
      return { level, count: matched.length, parts };
    });
    return { skill: skill.key, label: skill.label, groups };
  });
  return {
    status: anyPart ? 'ready' : 'no_part_scores',
    semester: requested,
    note: APPROACHING_NOTE,
    skills,
  };
}

function buildPartDiagnostics({ semester, registrations = [], scores = [] } = {}) {
  return {
    comparisonNote: COMPARISON_NOTE,
    history: buildHistory(scores),
    preExam: buildPreExam(semester, registrations, scores),
    approachingB2: buildApproaching(semester, scores),
  };
}

module.exports = {
  PART_SCORE_ATTRIBUTES,
  COMPARISON_NOTE,
  buildPartDiagnostics,
};
