'use strict';

const { normalizeExamTypeCode } = require('../utils/englishTestExamType');

const ATOMIC_SKILLS = ['L', 'R', 'S', 'W'];
const AGGREGATE_EXAM_TYPES = new Set(['LR', 'SW']);
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const B2_OR_ABOVE = new Set(['B2', 'C1', 'C2']);
const EXAM_TYPE_KEYS = ['LRSW', 'LR', 'SW', 'NON', 'other'];

const SCORE_SKILLS = [
  { code: 'L', key: 'listening', scoreField: 'listeningScore', levelField: 'listeningLevel', label: '聽力' },
  { code: 'R', key: 'reading', scoreField: 'readingScore', levelField: 'readingLevel', label: '閱讀' },
  { code: 'S', key: 'speaking', scoreField: 'speakingScore', levelField: 'speakingLevel', label: '口說' },
  { code: 'W', key: 'writing', scoreField: 'writingScore', levelField: 'writingLevel', label: '寫作' },
];

const PRESENT_LABEL = '匯入紀錄標示出席，來源尚待確認';
const ATTENDANCE_LIMITS = {
  confirmedAttendance: false,
  presentMeaning: 'import_marked_unconfirmed',
  presentLabel: PRESENT_LABEL,
};
const CEFR_RESOLUTION_NOTE = '圖上是匯入後保存的等級。未達 A1 會記成 A1；加號會拿掉，所以 B2+ 存成 B2，不會變成 C1。C1 與 C2 原樣保留。不能還原更細的等級。';

function trimText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function foldStudentKey(studentId) {
  const raw = trimText(studentId);
  if (!raw) return null;
  return raw.toUpperCase();
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

function emptyExamTypeCounts() {
  return { LRSW: 0, LR: 0, SW: 0, NON: 0, other: 0 };
}

function examTypeKey(examType) {
  const code = normalizeExamTypeCode(examType);
  return EXAM_TYPE_KEYS.includes(code) ? code : 'other';
}

function parseStoredScore(value) {
  if (value == null) return null;
  if (typeof value === 'string' && trimText(value) === '') return null;
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function attendanceMark(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 'present';
  if (value === false || value === 0 || value === '0' || value === 'false') return 'absent';
  return 'unreadable';
}

function indexByStudent(rows) {
  const byKey = new Map();
  let blankStudentIdCount = 0;
  for (const row of rows) {
    const raw = trimText(row.studentId);
    const key = foldStudentKey(raw);
    if (!key) {
      blankStudentIdCount += 1;
      continue;
    }
    if (!byKey.has(key)) byKey.set(key, { rawIds: new Set(), rows: [] });
    const bucket = byKey.get(key);
    bucket.rawIds.add(raw);
    bucket.rows.push(row);
  }
  return { byKey, blankStudentIdCount };
}

function collisionKeySet(index) {
  const keys = new Set();
  index.byKey.forEach((bucket, key) => {
    if (bucket.rawIds.size > 1) keys.add(key);
  });
  return keys;
}

function emptySkillAttendance(status) {
  return {
    eligible: status === 'not_for_all_semesters' ? null : 0,
    imported: null,
    markedPresent: null,
    markedAbsent: null,
    missingRecord: null,
    unreadableMark: null,
    status,
  };
}

function emptyCefrCounts() {
  return {
    A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, unrecognized: 0, missing: 0,
  };
}

function filterSemester(rows, semester) {
  const source = rows || [];
  if (!semester || semester === 'all') {
    const kept = source.filter((row) => {
      const value = trimText(row.semester);
      return value && value !== 'null';
    });
    return { kept, ignored: source.length - kept.length };
  }
  const kept = [];
  let ignored = 0;
  source.forEach((row) => {
    if (trimText(row.semester) === semester) kept.push(row);
    else ignored += 1;
  });
  return { kept, ignored };
}

function buildRegistrationSummary(registrations, registrationCollisions) {
  const counts = emptyExamTypeCounts();
  const successCounts = emptyExamTypeCounts();
  const identities = indexByStudent(registrations);
  let successStudentCount = 0;
  const examPopulation = new Set();

  registrations.forEach((row) => {
    const typeKey = examTypeKey(row.examType);
    counts[typeKey] += 1;
    const key = foldStudentKey(row.studentId);
    if (!isSuccessStatus(row.status)) return;
    successCounts[typeKey] += 1;
    if (!key) return;
    successStudentCount += 1;
    if (registrationCollisions.has(key)) return;
    if (componentsForExamType(row.examType).length > 0) examPopulation.add(key);
  });

  let distinctStudentCount = 0;
  identities.byKey.forEach((bucket, key) => {
    distinctStudentCount += registrationCollisions.has(key) ? bucket.rawIds.size : 1;
  });

  return {
    rowCount: registrations.length,
    distinctStudentCount,
    successStudentCount,
    blankStudentIdCount: identities.blankStudentIdCount,
    sameTableStudentIdCollisions: registrationCollisions.size,
    byExamType: counts,
    successByExamType: successCounts,
    examPopulationStudentCount: examPopulation.size,
  };
}

function buildAttendance(attendanceRows, registrations, registrationCollisions, attendanceCollisions, importBlocked) {
  if (importBlocked) {
    const skills = {};
    ATOMIC_SKILLS.forEach((skill) => {
      skills[skill] = emptySkillAttendance('not_for_all_semesters');
    });
    return {
      importStatus: 'not_for_all_semesters',
      ...ATTENDANCE_LIMITS,
      ignoredAggregateRows: 0,
      duplicateAtomicRows: 0,
      unmatchedImportRows: 0,
      caseFoldMatchCount: 0,
      skills,
    };
  }

  const registrationIndex = indexByStudent(registrations);
  const eligibleBySkill = { L: new Set(), R: new Set(), S: new Set(), W: new Set() };
  registrations.forEach((row) => {
    if (!isSuccessStatus(row.status)) return;
    const key = foldStudentKey(row.studentId);
    if (!key || registrationCollisions.has(key)) return;
    componentsForExamType(row.examType).forEach((skill) => eligibleBySkill[skill].add(key));
  });

  if (attendanceRows.length === 0) {
    const skills = {};
    ATOMIC_SKILLS.forEach((skill) => {
      skills[skill] = {
        ...emptySkillAttendance('no_import'),
        eligible: eligibleBySkill[skill].size,
      };
    });
    return {
      importStatus: 'none',
      ...ATTENDANCE_LIMITS,
      ignoredAggregateRows: 0,
      duplicateAtomicRows: 0,
      unmatchedImportRows: 0,
      caseFoldMatchCount: 0,
      skills,
    };
  }

  const marks = new Map();
  let ignoredAggregateRows = 0;
  let duplicateAtomicRows = 0;
  let unmatchedImportRows = 0;
  const caseFoldStudents = new Set();

  attendanceRows.forEach((row) => {
    const examType = trimText(row.examType).toUpperCase();
    if (AGGREGATE_EXAM_TYPES.has(examType)) {
      ignoredAggregateRows += 1;
      return;
    }
    const key = foldStudentKey(row.studentId);
    if (!ATOMIC_SKILLS.includes(examType) || !key || attendanceCollisions.has(key) || registrationCollisions.has(key) || !eligibleBySkill[examType].has(key)) {
      unmatchedImportRows += 1;
      return;
    }
    if (!marks.has(key)) marks.set(key, {});
    if (marks.get(key)[examType]) duplicateAtomicRows += 1;
    marks.get(key)[examType] = row;
    const registrationRaw = registrationIndex.byKey.get(key)
      ? [...registrationIndex.byKey.get(key).rawIds][0]
      : null;
    if (registrationRaw && registrationRaw !== trimText(row.studentId)) caseFoldStudents.add(key);
  });

  const skills = {};
  ATOMIC_SKILLS.forEach((skill) => {
    let imported = 0;
    let markedPresent = 0;
    let markedAbsent = 0;
    let unreadableMark = 0;
    eligibleBySkill[skill].forEach((key) => {
      const row = marks.get(key)?.[skill];
      if (!row) return;
      imported += 1;
      const mark = attendanceMark(row.attended);
      if (mark === 'present') markedPresent += 1;
      else if (mark === 'absent') markedAbsent += 1;
      else unreadableMark += 1;
    });
    skills[skill] = {
      eligible: eligibleBySkill[skill].size,
      imported,
      markedPresent,
      markedAbsent,
      missingRecord: eligibleBySkill[skill].size - imported,
      unreadableMark,
      status: 'imported',
    };
  });

  return {
    importStatus: 'imported',
    ...ATTENDANCE_LIMITS,
    ignoredAggregateRows,
    duplicateAtomicRows,
    unmatchedImportRows,
    caseFoldMatchCount: caseFoldStudents.size,
    skills,
  };
}

function buildScores(scoreRows, registrations, registrationCollisions, scoreCollisions, importBlocked) {
  const baseSkill = (status) => ({
    withScore: null,
    missingAmongEligible: null,
    eligible: status === 'not_for_all_semesters' ? null : 0,
    cefr: null,
    b2LevelCount: null,
    b2OrAboveCount: null,
    denominator: null,
    status,
  });

  if (importBlocked) {
    const skills = {};
    SCORE_SKILLS.forEach((skill) => {
      skills[skill.key] = { label: skill.label, ...baseSkill('not_for_all_semesters') };
    });
    return {
      importStatus: 'not_for_all_semesters',
      cefrResolutionNote: CEFR_RESOLUTION_NOTE,
      unmatchedScoreStudents: 0,
      duplicateScoreRows: 0,
      caseFoldMatchCount: 0,
      skills,
    };
  }

  const registrationIndex = indexByStudent(registrations);
  const eligibleBySkill = { L: new Set(), R: new Set(), S: new Set(), W: new Set() };
  const successExamKeys = new Set();
  registrations.forEach((row) => {
    if (!isSuccessStatus(row.status)) return;
    const key = foldStudentKey(row.studentId);
    if (!key || registrationCollisions.has(key)) return;
    const components = componentsForExamType(row.examType);
    if (components.length === 0) return;
    successExamKeys.add(key);
    components.forEach((skill) => eligibleBySkill[skill].add(key));
  });

  if (scoreRows.length === 0) {
    const skills = {};
    SCORE_SKILLS.forEach((skill) => {
      skills[skill.key] = {
        label: skill.label,
        ...baseSkill('no_import'),
        eligible: eligibleBySkill[skill.code].size,
      };
    });
    return {
      importStatus: 'none',
      cefrResolutionNote: CEFR_RESOLUTION_NOTE,
      unmatchedScoreStudents: 0,
      duplicateScoreRows: 0,
      caseFoldMatchCount: 0,
      skills,
    };
  }

  const latestByStudent = new Map();
  let duplicateScoreRows = 0;
  const unmatched = new Set();
  const seenScoreKeys = new Set();
  const caseFoldStudents = new Set();

  scoreRows.forEach((row) => {
    const key = foldStudentKey(row.studentId);
    if (key && seenScoreKeys.has(key)) duplicateScoreRows += 1;
    if (key) seenScoreKeys.add(key);
    if (!key || scoreCollisions.has(key) || registrationCollisions.has(key) || !successExamKeys.has(key)) {
      if (key) unmatched.add(key);
      else unmatched.add(`blank:${unmatched.size}`);
      return;
    }
    latestByStudent.set(key, row);
    const registrationRaw = [...registrationIndex.byKey.get(key).rawIds][0];
    if (registrationRaw !== trimText(row.studentId)) caseFoldStudents.add(key);
  });

  const skills = {};
  SCORE_SKILLS.forEach((skill) => {
    const cefr = emptyCefrCounts();
    let withScore = 0;
    latestByStudent.forEach((row, key) => {
      if (!eligibleBySkill[skill.code].has(key)) return;
      if (parseStoredScore(row[skill.scoreField]) == null) return;
      withScore += 1;
      const level = trimText(row[skill.levelField]).toUpperCase();
      if (!level) cefr.missing += 1;
      else if (CEFR_LEVELS.includes(level)) cefr[level] += 1;
      else cefr.unrecognized += 1;
    });
    const b2LevelCount = cefr.B2;
    const b2OrAboveCount = CEFR_LEVELS.reduce(
      (sum, level) => sum + (B2_OR_ABOVE.has(level) ? cefr[level] : 0),
      0,
    );
    let missingAmongEligible = 0;
    eligibleBySkill[skill.code].forEach((key) => {
      const row = latestByStudent.get(key);
      if (!row || parseStoredScore(row[skill.scoreField]) == null) missingAmongEligible += 1;
    });
    skills[skill.key] = {
      label: skill.label,
      withScore,
      missingAmongEligible,
      eligible: eligibleBySkill[skill.code].size,
      cefr,
      b2LevelCount,
      b2OrAboveCount,
      denominator: withScore,
      status: 'imported',
    };
  });

  return {
    importStatus: 'imported',
    cefrResolutionNote: CEFR_RESOLUTION_NOTE,
    unmatchedScoreStudents: unmatched.size,
    duplicateScoreRows,
    caseFoldMatchCount: caseFoldStudents.size,
    skills,
  };
}

function buildBestepAnalyticsExtension({
  semester,
  registrations = [],
  attendance = [],
  scores = [],
} = {}) {
  const requested = trimText(semester) || 'all';
  const registrationRows = filterSemester(registrations, requested);
  const attendanceRows = filterSemester(attendance, requested);
  const scoreRows = filterSemester(scores, requested);
  const blocked = requested === 'all';
  const registrationIndex = indexByStudent(registrationRows.kept);
  const attendanceIndex = indexByStudent(blocked ? [] : attendanceRows.kept);
  const scoreIndex = indexByStudent(blocked ? [] : scoreRows.kept);
  const registrationCollisions = collisionKeySet(registrationIndex);
  const attendanceCollisions = collisionKeySet(attendanceIndex);
  const scoreCollisions = collisionKeySet(scoreIndex);

  return {
    registrationSummary: {
      ...buildRegistrationSummary(registrationRows.kept, registrationCollisions),
      ignoredOtherSemesterRows: registrationRows.ignored,
    },
    attendance: {
      ...buildAttendance(
        blocked ? [] : attendanceRows.kept,
        registrationRows.kept,
        registrationCollisions,
        attendanceCollisions,
        blocked,
      ),
      ignoredOtherSemesterRows: attendanceRows.ignored,
      sameTableStudentIdCollisions: attendanceCollisions.size,
    },
    scores: {
      ...buildScores(
        blocked ? [] : scoreRows.kept,
        registrationRows.kept,
        registrationCollisions,
        scoreCollisions,
        blocked,
      ),
      ignoredOtherSemesterRows: scoreRows.ignored,
      sameTableStudentIdCollisions: scoreCollisions.size,
    },
  };
}

async function loadBestepAnalyticsExtension(semester) {
  const {
    EnglishTestRegistration,
    BestepAttendance,
    BestepExamScore,
  } = require('../models');
  const requested = trimText(semester);
  const attributes = {
    registration: ['studentId', 'semester', 'status', 'examType'],
    attendance: ['studentId', 'semester', 'examType', 'attended'],
    score: [
      'studentId', 'semester',
      'listeningScore', 'readingScore', 'speakingScore', 'writingScore',
      'listeningLevel', 'readingLevel', 'speakingLevel', 'writingLevel',
    ],
  };

  if (!requested || requested === 'all') {
    const registrations = await EnglishTestRegistration.findAll({
      attributes: attributes.registration,
      raw: true,
    });
    return buildBestepAnalyticsExtension({
      semester: 'all',
      registrations,
      attendance: [],
      scores: [],
    });
  }

  const where = { semester: requested };
  const [registrations, attendance, scores] = await Promise.all([
    EnglishTestRegistration.findAll({ where, attributes: attributes.registration, raw: true }),
    BestepAttendance.findAll({ where, attributes: attributes.attendance, raw: true }),
    BestepExamScore.findAll({ where, attributes: attributes.score, raw: true }),
  ]);
  return buildBestepAnalyticsExtension({
    semester: requested,
    registrations,
    attendance,
    scores,
  });
}

module.exports = {
  PRESENT_LABEL,
  CEFR_RESOLUTION_NOTE,
  buildBestepAnalyticsExtension,
  loadBestepAnalyticsExtension,
};
