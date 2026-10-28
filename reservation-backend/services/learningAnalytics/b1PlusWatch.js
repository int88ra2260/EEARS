'use strict';

/**
 * 「接近 B2」追蹤名單的純計算。
 * B2 仍是達標線。這裡用 GSE 找還沒達 B2、但已進入 B1+ 帶（GSE 51–58）的人。
 * 成效分析快照常把 CEFR 加號收成 B1／B2，不能再用字串「B1+」當條件。
 */

const {
  inferGse,
  gseBandForScore,
  GSE_CEFR_BANDS,
} = require('./gseScoreMappingService');

const SKILLS = Object.freeze(['listening', 'reading', 'speaking', 'writing']);
const PRE_PHASES = new Set(['pre_test', 'single']);

const APPROACHING_BAND = GSE_CEFR_BANDS.find((band) => band.subLevel === 'B1_PLUS') || {
  label: 'B1+',
  gseMin: 51,
  gseMax: 58,
};
const APPROACHING_GSE_MIN = APPROACHING_BAND.gseMin;
const APPROACHING_GSE_MAX = APPROACHING_BAND.gseMax;
const B2_GSE_MIN = (GSE_CEFR_BANDS.find((band) => band.subLevel === 'B2') || { gseMin: 59 }).gseMin;

const SITUATIONS = Object.freeze({
  neither: 'neither',
  course_only: 'course_only',
  activity_only: 'activity_only',
  both: 'both',
});

function exactCefrLabel(value) {
  if (value == null || value === '') return null;
  const label = String(value).trim().replace(/\s+/g, '').replace(/＋/g, '+').toUpperCase();
  const allowed = ['A1', 'A1+', 'A2', 'A2+', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2', 'C2+'];
  return allowed.includes(label) ? label : null;
}

function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

function flagged(value) {
  return value === true || value === 1 || value === '1';
}

function hoursPositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function examGse(exam) {
  if (!exam) return null;
  const result = inferGse({
    examType: exam.instrument,
    skill: exam.skill,
    rawScore: exam.rawScore,
    cefrLevel: exam.cefrLevel,
    examDate: exam.examDate,
  });
  if (result?.isMapped && Number.isFinite(result.gse)) return result.gse;
  // 少數來源仍保留 B1+ 字串；分析常用的 normalize 會拿掉加號，這裡單獨認
  const label = exactCefrLabel(exam.cefrLevel);
  if (label === 'B1+') return (APPROACHING_GSE_MIN + APPROACHING_GSE_MAX) / 2;
  return null;
}

function bandLabelForGse(gse) {
  const band = gseBandForScore(gse);
  return band?.label || null;
}

function usableExam(exam) {
  if (!exam || flagged(exam.excludeFlag)) return false;
  if (flagged(exam.registeredNoScoreFlag)) return false;
  if (String(exam.instrument || '').toUpperCase() === 'GSAT') return false;
  return examGse(exam) != null;
}

function isPretest(exam) {
  const phase = String(exam.testPhase || '').trim();
  if (PRE_PHASES.has(phase)) return true;
  if (!phase && Number(exam.examRound) === 1) return true;
  return false;
}

function skillMap(exams, pick) {
  const chosen = {};
  for (const exam of exams) {
    if (!usableExam(exam)) continue;
    const skill = String(exam.skill || '');
    if (!SKILLS.includes(skill)) continue;
    const current = chosen[skill];
    if (!current || pick(exam, current)) chosen[skill] = exam;
  }
  return chosen;
}

function preferHigherGse(next, current) {
  const nextGse = examGse(next);
  const currentGse = examGse(current);
  const nextOk = Number.isFinite(nextGse);
  const currentOk = Number.isFinite(currentGse);
  if (nextOk && !currentOk) return true;
  if (!nextOk && currentOk) return false;
  if (nextOk && currentOk && nextGse !== currentGse) return nextGse > currentGse;
  return String(next.examDate || '') > String(current.examDate || '');
}

function preferEarlierDate(next, current) {
  const nextDate = String(next.examDate || '');
  const currentDate = String(current.examDate || '');
  if (nextDate !== currentDate) return nextDate < currentDate;
  return preferHigherGse(next, current);
}

function skillGseMap(bySkill) {
  const out = {};
  for (const skill of SKILLS) {
    const gse = examGse(bySkill[skill]);
    out[skill] = gse == null ? null : round1(gse);
  }
  return out;
}

function skillBandMap(gseBySkill) {
  const out = {};
  for (const skill of SKILLS) {
    out[skill] = bandLabelForGse(gseBySkill[skill]);
  }
  return out;
}

function bestGse(gseBySkill) {
  let best = null;
  for (const skill of SKILLS) {
    const gse = gseBySkill[skill];
    if (!Number.isFinite(gse)) continue;
    if (best == null || gse > best) best = gse;
  }
  return best;
}

function isApproachingB2(gse) {
  return Number.isFinite(gse) && gse >= APPROACHING_GSE_MIN && gse <= APPROACHING_GSE_MAX;
}

function reachedB2(gse) {
  return Number.isFinite(gse) && gse >= B2_GSE_MIN;
}

/**
 * 「有修課」看選課紀錄（hasCourse），不看累積修課時數。
 * 目前常只有該學期選課、尚無成績，時數會是 0。
 */
function situationOf(hasCourse, activityHours) {
  const course = Boolean(hasCourse);
  const activity = hoursPositive(activityHours);
  if (!course && !activity) return SITUATIONS.neither;
  if (course && !activity) return SITUATIONS.course_only;
  if (!course && activity) return SITUATIONS.activity_only;
  return SITUATIONS.both;
}

/**
 * @param {object[]} enrollments course_enrollments 列（至少 studentId、semesterId、enrollmentStatus）
 * @param {string} currentSemester 當下時間所屬學期（例 115-1）
 * @returns {Map<string, { hasCourse: boolean, courseInProgress: boolean }>}
 */
function buildCourseEngagementMap(enrollments = [], currentSemester = '') {
  const current = String(currentSemester || '').trim();
  const map = new Map();
  for (const row of enrollments) {
    const id = String(row.studentId || '').trim().toUpperCase();
    if (!id) continue;
    if (String(row.enrollmentStatus || '').trim().toLowerCase() === 'withdrawn') continue;
    const prev = map.get(id) || { hasCourse: false, courseInProgress: false };
    prev.hasCourse = true;
    if (current && String(row.semesterId || '').trim() === current) {
      prev.courseInProgress = true;
    }
    map.set(id, prev);
  }
  return map;
}

function hasPretestGse(pretestGse) {
  return SKILLS.some((skill) => Number.isFinite(pretestGse[skill]));
}

/**
 * @param {object[]} students 尚未達 B2 的分析摘要列（isB2plus=false）
 * @param {object[]} exams 這些學生的英檢列
 * @param {Map<string, { hasCourse?: boolean, courseInProgress?: boolean }>|Record<string, object>} [courseEngagement]
 */
function buildB1PlusWatch(students = [], exams = [], courseEngagement = null) {
  const examsByStudent = new Map();
  for (const exam of exams) {
    const id = String(exam.studentId || '').trim().toUpperCase();
    if (!id) continue;
    if (!examsByStudent.has(id)) examsByStudent.set(id, []);
    examsByStudent.get(id).push(exam);
  }

  const engagementOf = (studentId) => {
    const key = String(studentId || '').trim().toUpperCase();
    if (!courseEngagement) return { hasCourse: false, courseInProgress: false };
    if (typeof courseEngagement.get === 'function') {
      return courseEngagement.get(key) || { hasCourse: false, courseInProgress: false };
    }
    return courseEngagement[key] || { hasCourse: false, courseInProgress: false };
  };

  const items = [];
  for (const student of students) {
    if (flagged(student.isB2plus)) continue;
    const id = String(student.studentId || '').trim();
    if (!id) continue;
    const rows = examsByStudent.get(id.toUpperCase()) || [];
    const current = skillMap(rows, preferHigherGse);
    const currentGse = skillGseMap(current);
    const highest = bestGse(currentGse);
    if (!isApproachingB2(highest) || reachedB2(highest)) continue;

    const pretestRows = rows.filter(isPretest);
    const pretestExams = skillMap(pretestRows, preferEarlierDate);
    const pretestGse = skillGseMap(pretestExams);
    const pretest = skillBandMap(pretestGse);
    const courseHours = round1(student.totalCourseHours) || 0;
    const activityHours = round1(student.totalActivityHours) || 0;
    const engagement = engagementOf(id);
    const hasCourse = Boolean(engagement.hasCourse);
    const courseInProgress = Boolean(engagement.courseInProgress);
    items.push({
      studentId: id,
      department: student.department || null,
      college: student.college || null,
      cohort: student.cohort || null,
      currentLevel: APPROACHING_BAND.label || 'B1+',
      bestGse: round1(highest),
      currentGse,
      currentBands: skillBandMap(currentGse),
      pretest,
      pretestGse,
      hasPretest: hasPretestGse(pretestGse),
      hasCourse,
      courseInProgress,
      courseHours,
      activityHours,
      situation: situationOf(hasCourse, activityHours),
    });
  }

  items.sort((a, b) => {
    const gseCmp = (Number(b.bestGse) || 0) - (Number(a.bestGse) || 0);
    if (gseCmp !== 0) return gseCmp;
    const dept = String(a.department || '').localeCompare(String(b.department || ''), 'zh-Hant');
    if (dept !== 0) return dept;
    return a.studentId.localeCompare(b.studentId, 'zh-Hant');
  });

  return items;
}

function summarizeB1PlusWatch(items = []) {
  const summary = {
    matched: items.length,
    withPretest: 0,
    withCourse: 0,
    withCourseInProgress: 0,
    withActivity: 0,
    neither: 0,
    courseOnly: 0,
    activityOnly: 0,
    both: 0,
    gseMin: APPROACHING_GSE_MIN,
    gseMax: APPROACHING_GSE_MAX,
  };
  for (const item of items) {
    if (item.hasPretest) summary.withPretest += 1;
    if (item.hasCourse) summary.withCourse += 1;
    if (item.courseInProgress) summary.withCourseInProgress += 1;
    if (hoursPositive(item.activityHours)) summary.withActivity += 1;
    if (item.situation === SITUATIONS.neither) summary.neither += 1;
    else if (item.situation === SITUATIONS.course_only) summary.courseOnly += 1;
    else if (item.situation === SITUATIONS.activity_only) summary.activityOnly += 1;
    else if (item.situation === SITUATIONS.both) summary.both += 1;
  }
  return summary;
}

function filterByEngagement(items, engagement) {
  const key = String(engagement || '').trim();
  if (!key || key === 'any') return items;
  return items.filter((item) => item.situation === key);
}

function filterByHasPretest(items, hasPretest) {
  const key = String(hasPretest || '').trim().toLowerCase();
  if (!key || key === 'any') return items;
  if (key === 'yes') return items.filter((item) => item.hasPretest);
  if (key === 'no') return items.filter((item) => !item.hasPretest);
  return items;
}

/**
 * 某一科前測 GSE 低於接近 B2 帶（&lt; 51）。
 */
function filterByWeakPretestSkill(items, skill) {
  const key = String(skill || '').trim().toLowerCase();
  if (!key || !SKILLS.includes(key)) return items;
  return items.filter((item) => {
    const raw = item.pretestGse?.[key];
    if (raw == null || raw === '') return false;
    const gse = Number(raw);
    return Number.isFinite(gse) && gse < APPROACHING_GSE_MIN;
  });
}

function filterByKeyword(items, keyword) {
  const needle = String(keyword || '').trim().toUpperCase();
  if (!needle) return items;
  return items.filter((item) => {
    const id = String(item.studentId || '').toUpperCase();
    const name = String(item.studentName || '').toUpperCase();
    return id.includes(needle) || name.includes(needle);
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))]
    .sort((a, b) => a.localeCompare(b, 'zh-Hant'));
}

function optionValues(list) {
  return (list || [])
    .map((item) => (typeof item === 'string' ? item : item?.value))
    .filter(Boolean);
}

module.exports = {
  APPROACHING_GSE_MIN,
  APPROACHING_GSE_MAX,
  B2_GSE_MIN,
  SKILLS,
  SITUATIONS,
  exactCefrLabel,
  examGse,
  buildCourseEngagementMap,
  buildB1PlusWatch,
  summarizeB1PlusWatch,
  filterByEngagement,
  filterByHasPretest,
  filterByWeakPretestSkill,
  filterByKeyword,
  uniqueSorted,
  optionValues,
};
