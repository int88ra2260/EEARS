'use strict';

const { Op } = require('sequelize');
const {
  LjStudentEvent,
  LjAnalyticStudent,
  LjAnalyticExam,
  EtEnrollmentSnapshot,
} = require('../../../models');
const {
  RULE_VERSION,
  EVENT_TYPES,
  EVENT_STATUS,
  EXPOSURE_LEVELS,
  SKILLS,
  B2_RANK,
} = require('../../../constants/learningJourneyEventConstants');
const { deriveEnrollmentTerm } = require('../utils/semIndexCalculator');
const { assertBeforeExposure } = require('../utils/eventQualityAssertions');
const { buildSnapshotVersion } = require('../utils/snapshotVersion');
const { getCefrRank, getCefrFromRank } = require('../utils/cefr');
const { inferGsatOverallCefr, normalizeBaselineCefrKey } = require('../../learningAnalytics/baselineAbilityUtils');
const { projectAllEvents, normSid, loadEnrollmentMeta } = require('./eventProjectorService');
const { resolveRebuildStudentIds } = require('./analyticStudentIdResolver');
const {
  buildInstrumentSessions,
  listInstruments,
  pickPrimaryInstrument,
  resolveTestPhase,
  sumResourceInExposureWindow,
} = require('./examSessionService');

function chunkArray(items, size) {
  const n = Math.max(1, Number(size) || 50);
  const chunks = [];
  for (let i = 0; i < items.length; i += n) {
    chunks.push(items.slice(i, i + n));
  }
  return chunks;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolveExposureLevel(hours) {
  const h = Number(hours) || 0;
  if (h <= 0) return EXPOSURE_LEVELS.NONE;
  if (h < 10) return EXPOSURE_LEVELS.LOW;
  if (h <= 30) return EXPOSURE_LEVELS.MEDIUM;
  return EXPOSURE_LEVELS.HIGH;
}

function isIncludedEvent(ev, includeExcluded = false) {
  if (!includeExcluded && ev.excludeFlag) return false;
  if (ev.status === EVENT_STATUS.VOID) return false;
  return true;
}

function sumResourceBefore(examDate, resources) {
  const included = (resources || []).filter((r) => isIncludedEvent(r));
  return sumResourceInExposureWindow(examDate, included, null);
}

function buildAnalyticExamRows(events, snapshotVersion, derivedAt) {
  const examEvents = events.filter((e) => e.eventType === EVENT_TYPES.EXAM);
  const resourceEvents = events.filter((e) =>
    [EVENT_TYPES.COURSE, EVENT_TYPES.ACTIVITY].includes(e.eventType) && isIncludedEvent(e)
  );

  const byStudent = new Map();
  for (const ev of examEvents) {
    if (!byStudent.has(ev.studentId)) byStudent.set(ev.studentId, []);
    byStudent.get(ev.studentId).push(ev);
  }

  const rows = [];
  for (const [studentId, studentExams] of byStudent.entries()) {
    const studentResources = resourceEvents.filter((r) => r.studentId === studentId);
    const instruments = listInstruments(studentExams);

    for (const instrument of instruments) {
      const sessions = buildInstrumentSessions(studentExams, instrument);
      const totalRounds = sessions.length;

      for (let i = 0; i < sessions.length; i += 1) {
        const session = sessions[i];
        const previousSession = i > 0 ? sessions[i - 1] : null;
        const exposureWindowStart = previousSession ? previousSession.sessionEnd : null;
        const testPhase = resolveTestPhase(session.roundIndex, totalRounds);
        const previousScoresBySkill = new Map();
        if (previousSession) {
          for (const cell of previousSession.cells) {
            previousScoresBySkill.set(cell.skill, cell.event);
          }
        }

        for (const cell of session.cells) {
          const ev = cell.event;
          const before = sumResourceInExposureWindow(
            ev.eventDate,
            studentResources,
            exposureWindowStart
          );
          const rank = getCefrRank(ev.cefrLevel);
          const isB2plus = rank != null && rank >= B2_RANK;
          const registeredNoScore = ev.status === EVENT_STATUS.REGISTERED_NO_SCORE;

          const previousEv = previousScoresBySkill.get(ev.skill) || null;
          let delta = null;
          let improved = null;
          let previousEventId = null;
          let previousScore = null;
          if (previousEv && !registeredNoScore && ev.rawScore != null && previousEv.rawScore != null) {
            previousEventId = previousEv.id;
            previousScore = num(previousEv.rawScore);
            delta = num(ev.rawScore) - previousScore;
            improved = delta > 0;
          }

          rows.push({
            studentId,
            examEventId: ev.id,
            examDate: ev.eventDate,
            instrument: ev.instrument,
            skill: ev.skill,
            rawScore: ev.rawScore,
            cefrLevel: ev.cefrLevel,
            isB2plus,
            examSeq: session.roundIndex,
            examRound: session.roundIndex,
            testPhase,
            sessionDateStart: session.sessionStart,
            sessionDateEnd: session.sessionEnd,
            exposureWindowStart,
            timing: ev.timing,
            previousExamEventId: previousEventId,
            previousRawScore: previousScore,
            deltaRawScore: delta,
            improvedFlag: improved,
            retestFlag: session.roundIndex >= 2,
            courseHoursBeforeExam: before.courseHours,
            activityHoursBeforeExam: before.activityHours,
            resourceHoursBeforeExam: before.resourceHours,
            courseCountBeforeExam: before.courseCount,
            activityCountBeforeExam: before.activityCount,
            exposureBeforeExamFlag: before.exposureBeforeExamFlag,
            registeredNoScoreFlag: registeredNoScore,
            excludeFlag: ev.excludeFlag,
            reasonCode: ev.reasonCode,
            status: ev.status,
            snapshotVersion,
            ruleVersion: RULE_VERSION,
            derivedAt,
          });
        }
      }
    }
  }

  return rows;
}

async function loadRosterMeta(studentIds) {
  const map = new Map();
  const rows = await EtEnrollmentSnapshot.findAll({
    where: { studentId: { [Op.in]: studentIds }, isActive: true },
    order: [['semesterId', 'DESC']],
  });
  for (const row of rows) {
    const sid = normSid(row.studentId);
    if (map.has(sid)) continue;
    map.set(sid, {
      college: row.college || null,
      department: row.department || null,
      isOverseasStudent: row.isDomestic === false,
    });
  }
  return map;
}

function buildAnalyticStudentRows(events, enrollmentMap, rosterMap, snapshotVersion, derivedAt) {
  const byStudent = new Map();
  for (const ev of events) {
    if (!byStudent.has(ev.studentId)) byStudent.set(ev.studentId, []);
    byStudent.get(ev.studentId).push(ev);
  }

  const examRows = buildAnalyticExamRows(events, snapshotVersion, derivedAt);
  const examsByStudent = new Map();
  for (const row of examRows) {
    if (!examsByStudent.has(row.studentId)) examsByStudent.set(row.studentId, []);
    examsByStudent.get(row.studentId).push(row);
  }

  const students = [];
  for (const [studentId, list] of byStudent.entries()) {
    const enroll = enrollmentMap.get(studentId) || {};
    const roster = rosterMap.get(studentId) || {};
    const baseline = list.find((e) => e.eventType === EVENT_TYPES.BASELINE);
    const courses = list.filter((e) => e.eventType === EVENT_TYPES.COURSE && isIncludedEvent(e));
    const activities = list.filter((e) => e.eventType === EVENT_TYPES.ACTIVITY && isIncludedEvent(e));
    const exams = (examsByStudent.get(studentId) || []).filter((e) => !e.excludeFlag);

    const totalCourseHours = courses.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const totalActivityHours = activities.reduce((s, e) => s + (Number(e.hours) || 0), 0);
    const totalResourceHours = totalCourseHours + totalActivityHours;

    const validExams = exams.filter((e) => !e.registeredNoScoreFlag && e.rawScore != null);
    const primaryInstrument = pickPrimaryInstrument(validExams.map((e) => ({
      instrument: e.instrument,
      skill: e.skill,
      excludeFlag: false,
      rawScore: e.rawScore,
      status: EVENT_STATUS.VALID,
    })));
    const primaryExams = primaryInstrument
      ? validExams.filter((e) => String(e.instrument).toUpperCase() === primaryInstrument)
      : [];
    const primaryRounds = [...new Set(primaryExams.map((e) => e.examRound).filter(Boolean))].sort();
    const round1Exams = primaryExams.filter((e) => e.examRound === 1);
    const validExamDates = validExams.map((e) => e.examDate).sort();
    const firstExamDate = round1Exams.length
      ? round1Exams.map((e) => e.examDate).sort()[0]
      : (validExamDates[0] || null);
    const lastExamDate = validExamDates[validExamDates.length - 1] || null;

    let preCourse = 0;
    let preActivity = 0;
    let postCourse = 0;
    let postActivity = 0;
    if (firstExamDate) {
      for (const c of courses) {
        const h = Number(c.hours) || 0;
        if (assertBeforeExposure(firstExamDate, c.eventDate)) preCourse += h;
        else postCourse += h;
      }
      for (const a of activities) {
        const h = Number(a.hours) || 0;
        if (assertBeforeExposure(firstExamDate, a.eventDate)) preActivity += h;
        else postActivity += h;
      }
    }

    const bestBySkill = {};
    for (const sk of SKILLS) {
      const scored = exams.filter((e) => e.skill === sk && e.rawScore != null);
      scored.sort((a, b) => Number(b.rawScore) - Number(a.rawScore));
      bestBySkill[sk] = scored[0] || null;
    }

    const reasonSet = new Set(list.filter((e) => e.reasonCode).map((e) => e.reasonCode));
    const hasRetest = primaryRounds.some((round) => round >= 2);
    const hasRegisteredNoScore = list.some((e) => e.status === EVENT_STATUS.REGISTERED_NO_SCORE);
    const hasValidExam = validExamDates.length > 0;
    const bestRanks = SKILLS.map((sk) => getCefrRank(bestBySkill[sk]?.cefrLevel)).filter((r) => r != null);
    const bestCefrRank = bestRanks.length ? Math.max(...bestRanks) : null;
    const baselineCefr = normalizeBaselineCefrKey(baseline?.cefrLevel)
      || inferGsatOverallCefr(baseline?.rawScore != null ? num(baseline.rawScore) : null)
      || null;

    students.push({
      studentId,
      cohort: enroll.cohort || null,
      enrollmentTerm: enroll.enrollmentTerm || deriveEnrollmentTerm(enroll.cohort) || null,
      college: roster.college || enroll.college || null,
      department: roster.department || enroll.department || null,
      admissionType: null,
      isOverseasStudent: !!roster.isOverseasStudent,
      baselineEnglishScore: baseline?.rawScore != null ? num(baseline.rawScore) : null,
      baselineLevel: baselineCefr || baseline?.subtitle || null,
      baselineCefr,
      examCount: primaryRounds.length || new Set(validExams.map((e) => `${e.examDate}|${e.instrument}`)).size,
      retestFlag: hasRetest,
      firstExamDate,
      lastExamDate,
      bestListeningScore: bestBySkill.listening?.rawScore ?? null,
      bestReadingScore: bestBySkill.reading?.rawScore ?? null,
      bestSpeakingScore: bestBySkill.speaking?.rawScore ?? null,
      bestWritingScore: bestBySkill.writing?.rawScore ?? null,
      bestCefr: bestCefrRank ? getCefrFromRank(bestCefrRank) : null,
      isB2plus: bestCefrRank != null && bestCefrRank >= B2_RANK,
      totalCourseHours,
      totalActivityHours,
      totalResourceHours,
      preExamCourseHours: firstExamDate ? preCourse : null,
      preExamActivityHours: firstExamDate ? preActivity : null,
      postExamCourseHours: firstExamDate ? postCourse : null,
      postExamActivityHours: firstExamDate ? postActivity : null,
      exposureLevel: resolveExposureLevel(preCourse + preActivity),
      hasValidExam,
      hasRegisteredNoScore,
      excludeFlagSummary: list.some((e) => e.excludeFlag),
      reasonCodesSummary: [...reasonSet].join(','),
      snapshotVersion,
      ruleVersion: RULE_VERSION,
      derivedAt,
    });
  }
  return { students, exams: examRows };
}

async function rebuildAnalytics(opts = {}) {
  const cutoffAt = opts.cutoffAt ? new Date(opts.cutoffAt) : new Date();
  const scope = opts.scope || 'global';
  const snapshotVersion = opts.snapshotVersion || buildSnapshotVersion({ scope, cutoffAt, sequence: 1 });
  const derivedAt = cutoffAt;

  const projectResult = await projectAllEvents({ studentIds: opts.studentIds });
  const where = opts.studentIds?.length
    ? { studentId: { [Op.in]: opts.studentIds.map(normSid) } }
    : {};
  const events = await LjStudentEvent.findAll({ where, order: [['eventDate', 'ASC'], ['id', 'ASC']] });
  const studentIds = [...new Set(events.map((e) => e.studentId))];
  const enrollmentMap = await loadEnrollmentMeta(studentIds);
  const rosterMap = await loadRosterMeta(studentIds);

  const { students, exams } = buildAnalyticStudentRows(
    events.map((e) => e.toJSON()),
    enrollmentMap,
    rosterMap,
    snapshotVersion,
    derivedAt
  );

  await LjAnalyticExam.destroy({ where: { snapshotVersion, ...where } });
  await LjAnalyticStudent.destroy({ where: { snapshotVersion, ...where } });

  if (exams.length) await LjAnalyticExam.bulkCreate(exams);
  if (students.length) await LjAnalyticStudent.bulkCreate(students);

  return {
    snapshotVersion,
    ruleVersion: RULE_VERSION,
    derivedAt: derivedAt.toISOString(),
    projectResult,
    eventCount: events.length,
    analyticStudentCount: students.length,
    analyticExamCount: exams.length,
  };
}

/**
 * 分批重建，避免單次 HTTP / 記憶體過載。
 * @param {object} opts
 * @param {number} [opts.batchSize=50]
 * @param {(progress: object) => void} [opts.onBatch]
 */
async function rebuildAnalyticsInBatches(opts = {}) {
  const batchSize = Number(opts.batchSize) > 0 ? Number(opts.batchSize) : 50;
  const cutoffAt = opts.cutoffAt ? new Date(opts.cutoffAt) : new Date();
  const scope = opts.scope || 'global';
  const snapshotVersion = opts.snapshotVersion || buildSnapshotVersion({ scope, cutoffAt, sequence: 1 });
  const studentIds = await resolveRebuildStudentIds(opts);
  const batches = chunkArray(studentIds, batchSize);

  const progress = {
    totalStudents: studentIds.length,
    batchSize,
    batchCount: batches.length,
    completedBatches: 0,
    errors: [],
  };

  let lastResult = null;
  for (const batch of batches) {
    try {
      lastResult = await rebuildAnalytics({
        ...opts,
        scope,
        cutoffAt,
        snapshotVersion,
        studentIds: batch,
      });
      progress.completedBatches += 1;
      if (typeof opts.onBatch === 'function') {
        opts.onBatch({
          ...progress,
          batchStudentCount: batch.length,
          batchResult: lastResult,
        });
      }
    } catch (err) {
      progress.errors.push({
        batchStudentCount: batch.length,
        message: err?.message || String(err),
      });
      if (!opts.continueOnError) throw err;
    }
  }

  if (!lastResult && progress.errors.length) {
    const err = new Error(`analytic 重建失敗：${progress.errors[0].message}`);
    err.progress = progress;
    throw err;
  }

  return {
    ...(lastResult || {
      snapshotVersion,
      ruleVersion: RULE_VERSION,
      derivedAt: cutoffAt.toISOString(),
      eventCount: 0,
      analyticStudentCount: 0,
      analyticExamCount: 0,
    }),
    progress,
    totalStudents: studentIds.length,
  };
}

module.exports = {
  rebuildAnalytics,
  rebuildAnalyticsInBatches,
  resolveRebuildStudentIds,
  buildAnalyticExamRows,
  buildAnalyticStudentRows,
  sumResourceBefore,
  resolveExposureLevel,
};
