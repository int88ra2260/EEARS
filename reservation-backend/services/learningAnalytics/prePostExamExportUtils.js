'use strict';

/**
 * 匯出層：前測／後測寬表與考試表明細（委派 examSessionService + analytic 欄位）。
 */
const {
  EXAM_SESSION_WINDOW_DAYS,
  clusterExamDates,
  buildInstrumentSessions,
  pickPrimaryInstrument,
  formatTestPhaseLabel,
  resolveTestPhase,
} = require('../learningJourney/analytics/examSessionService');

const SKILL_EXPORT_FIELDS = [
  { skill: 'listening', label: '聽力', scoreKey: 'listening', cefrKey: 'listeningCefr' },
  { skill: 'reading', label: '閱讀', scoreKey: 'reading', cefrKey: 'readingCefr' },
  { skill: 'speaking', label: '口說', scoreKey: 'speaking', cefrKey: 'speakingCefr' },
  { skill: 'writing', label: '寫作', scoreKey: 'writing', cefrKey: 'writingCefr' },
];

function capitalize(key) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function applyRoundToBucket(bucket, round, phase) {
  for (const { skill, scoreKey, cefrKey } of SKILL_EXPORT_FIELDS) {
    const score = round.skills?.[skill];
    const cefr = round.cefrs?.[skill];
    if (score != null) bucket[`${phase}${capitalize(scoreKey)}Score`] = score;
    if (cefr) bucket[`${phase}${capitalize(cefrKey)}`] = cefr;
  }
}

function computeDeltas(bucket) {
  for (const { scoreKey } of SKILL_EXPORT_FIELDS) {
    const pre = bucket[`pre${capitalize(scoreKey)}Score`];
    const post = bucket[`post${capitalize(scoreKey)}Score`];
    if (pre != null && post != null) {
      bucket[`delta${capitalize(scoreKey)}Score`] = Number(post) - Number(pre);
    }
  }
  return bucket;
}

function sessionToSkillMaps(session) {
  const skills = {};
  const cefrs = {};
  for (const cell of session.cells) {
    skills[cell.skill] = Number(cell.event.rawScore);
    cefrs[cell.skill] = cell.event.cefrLevel || null;
  }
  return { skills, cefrs };
}

function buildStudentPrePostExportRow(student, examRows = []) {
  const base = {
    studentId: student.studentId,
    cohort: student.cohort ?? null,
    college: student.college ?? null,
    department: student.department ?? null,
    baselineEnglishScore: student.baselineEnglishScore ?? null,
    baselineCefr: student.baselineCefr ?? null,
    bestCefr: student.bestCefr ?? null,
    isB2plus: student.isB2plus ?? false,
    primaryInstrument: null,
    examRoundCount: 0,
    preTestLabel: null,
    preTestDateStart: null,
    preTestDateEnd: null,
    postTestLabel: null,
    postTestDateStart: null,
    postTestDateEnd: null,
    preListeningScore: null,
    preReadingScore: null,
    preSpeakingScore: null,
    preWritingScore: null,
    preListeningCefr: null,
    preReadingCefr: null,
    preSpeakingCefr: null,
    preWritingCefr: null,
    postListeningScore: null,
    postReadingScore: null,
    postSpeakingScore: null,
    postWritingScore: null,
    postListeningCefr: null,
    postReadingCefr: null,
    postSpeakingCefr: null,
    postWritingCefr: null,
    deltaListeningScore: null,
    deltaReadingScore: null,
    deltaSpeakingScore: null,
    deltaWritingScore: null,
  };

  const instrument = pickPrimaryInstrument(examRows);
  if (!instrument) return base;

  const sessions = buildInstrumentSessions(examRows, instrument);
  base.primaryInstrument = instrument;
  base.examRoundCount = sessions.length;

  const preSession = sessions[0] || null;
  const postSession = sessions[1] || null;

  if (preSession) {
    base.preTestLabel = '第1梯檢定';
    base.preTestDateStart = preSession.sessionStart;
    base.preTestDateEnd = preSession.sessionEnd;
    applyRoundToBucket(base, sessionToSkillMaps(preSession), 'pre');
  }
  if (postSession) {
    base.postTestLabel = '第2梯檢定';
    base.postTestDateStart = postSession.sessionStart;
    base.postTestDateEnd = postSession.sessionEnd;
    applyRoundToBucket(base, sessionToSkillMaps(postSession), 'post');
  }

  return computeDeltas(base);
}

function enrichExamExportRow(examRow, examsForStudent = []) {
  const hasSessionFields = examRow.examRound != null && examRow.testPhase;
  if (hasSessionFields) {
    return {
      studentId: examRow.studentId,
      instrument: examRow.instrument,
      examRound: examRow.examRound,
      testPhase: formatTestPhaseLabel(examRow.testPhase),
      sessionDateStart: examRow.sessionDateStart,
      sessionDateEnd: examRow.sessionDateEnd,
      skill: examRow.skill,
      examDate: examRow.examDate,
      rawScore: examRow.rawScore,
      cefrLevel: examRow.cefrLevel,
      isB2plus: examRow.isB2plus,
      previousRawScore: examRow.previousRawScore,
      deltaRawScore: examRow.deltaRawScore,
      courseHoursBeforeExam: examRow.courseHoursBeforeExam,
      activityHoursBeforeExam: examRow.activityHoursBeforeExam,
      resourceHoursBeforeExam: examRow.resourceHoursBeforeExam,
      exposureWindowStart: examRow.exposureWindowStart,
    };
  }

  const instrument = String(examRow.instrument || '').toUpperCase();
  const sessions = buildInstrumentSessions(examsForStudent, instrument);
  const totalRounds = sessions.length;
  const examDate = String(examRow.examDate || '').slice(0, 10);
  const session = sessions.find((item) => item.sessionDates.includes(examDate));
  const testPhase = session ? resolveTestPhase(session.roundIndex, totalRounds) : null;

  return {
    studentId: examRow.studentId,
    instrument: examRow.instrument,
    examRound: session?.roundIndex ?? null,
    testPhase: formatTestPhaseLabel(testPhase),
    sessionDateStart: session?.sessionStart ?? examDate,
    sessionDateEnd: session?.sessionEnd ?? examDate,
    skill: examRow.skill,
    examDate: examRow.examDate,
    rawScore: examRow.rawScore,
    cefrLevel: examRow.cefrLevel,
    isB2plus: examRow.isB2plus,
    previousRawScore: examRow.previousRawScore,
    deltaRawScore: examRow.deltaRawScore,
    courseHoursBeforeExam: examRow.courseHoursBeforeExam,
    activityHoursBeforeExam: examRow.activityHoursBeforeExam,
    resourceHoursBeforeExam: examRow.resourceHoursBeforeExam,
    exposureWindowStart: examRow.exposureWindowStart ?? null,
  };
}

module.exports = {
  EXAM_SESSION_WINDOW_DAYS,
  clusterExamDates,
  buildInstrumentSessions,
  pickPrimaryInstrument,
  formatTestPhaseLabel,
  resolveTestPhase,
  buildStudentPrePostExportRow,
  enrichExamExportRow,
};
