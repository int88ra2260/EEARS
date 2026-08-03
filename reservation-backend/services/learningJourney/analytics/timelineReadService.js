'use strict';

const {
  LjStudentEvent,
  LjAnalyticStudent,
  LjAnalyticExam,
  EtEnrollmentSnapshot,
  Student,
} = require('../../../models');
const {
  EVENT_TYPES,
  EVENT_STATUS,
  B2_RANK,
} = require('../../../constants/learningJourneyEventConstants');
const { termLabelFromSemIndex, parseSemesterId } = require('../utils/semIndexCalculator');
const { semesterIdFromDate } = require('../../../utils/semesterConstants');
const { assertBeforeExposure } = require('../utils/eventQualityAssertions');
const { buildSnapshotVersion, parseSnapshotVersion } = require('../utils/snapshotVersion');
const { getCefrRank } = require('../utils/cefr');
const { normSid } = require('./eventProjectorService');

function laneForEventType(eventType) {
  if (eventType === EVENT_TYPES.BASELINE) return 'baseline';
  if (eventType === EVENT_TYPES.EXAM) return 'exam';
  if (eventType === EVENT_TYPES.COURSE) return 'course';
  if (eventType === EVENT_TYPES.ACTIVITY) return 'activity';
  return 'other';
}

function resolveExposureRelation(event, referenceExamDate) {
  if (!referenceExamDate || !event.eventDate) return 'not_applicable';
  if ([EVENT_TYPES.EXAM, EVENT_TYPES.BASELINE].includes(event.eventType)) return 'not_applicable';
  return assertBeforeExposure(referenceExamDate, event.eventDate) ? 'before_exam' : 'after_exam';
}

function buildBadges(ev, exposureRelation) {
  const badges = [];
  const rank = getCefrRank(ev.cefrLevel);
  if (rank != null && rank >= B2_RANK) badges.push('B2+');
  if (ev.status === EVENT_STATUS.REGISTERED_NO_SCORE) badges.push('未出分');
  if (ev.excludeFlag) badges.push('已排除');
  if (exposureRelation === 'before_exam') badges.push('考前暴露');
  if (exposureRelation === 'after_exam') badges.push('考後');
  return badges;
}

async function resolveLatestSnapshotVersion() {
  const row = await LjAnalyticStudent.findOne({
    attributes: ['snapshotVersion'],
    order: [['derivedAt', 'DESC']],
  });
  if (row?.snapshotVersion) return row.snapshotVersion;
  return buildSnapshotVersion();
}

function resolveTimelineTermLabel(eventJson, enrollmentTerm) {
  if (eventJson.semIndex != null && enrollmentTerm) {
    const fromIndex = termLabelFromSemIndex(enrollmentTerm, eventJson.semIndex);
    if (fromIndex && parseSemesterId(fromIndex)) return fromIndex;
  }
  if (parseSemesterId(eventJson.academicTerm)) return eventJson.academicTerm;
  if (eventJson.eventDate) {
    const fromDate = semesterIdFromDate(eventJson.eventDate);
    if (fromDate) return fromDate;
  }
  return null;
}

async function getStudentTimeline(studentId, opts = {}) {
  const sid = normSid(studentId);
  if (!sid) return null;

  const snapshotVersion = opts.snapshotVersion || await resolveLatestSnapshotVersion();
  const events = await LjStudentEvent.findAll({
    where: { studentId: sid, excludeFlag: false },
    order: [['eventDate', 'ASC'], ['id', 'ASC']],
  });

  const analyticStudent = await LjAnalyticStudent.findOne({
    where: { studentId: sid, snapshotVersion },
  });
  const analyticExams = await LjAnalyticExam.findAll({
    where: { studentId: sid, snapshotVersion },
    order: [['examDate', 'ASC'], ['id', 'ASC']],
  });

  const studentRow = await Student.findOne({ where: { studentId: sid } });
  const roster = await EtEnrollmentSnapshot.findOne({
    where: { studentId: sid, isActive: true },
    order: [['semesterId', 'DESC']],
  });

  const referenceExamDate = analyticStudent?.firstExamDate
    || analyticExams.find((e) => e.rawScore != null && !e.registeredNoScoreFlag)?.examDate
    || null;

  const enrollmentTerm = analyticStudent?.enrollmentTerm || null;
  const timeline = events.map((ev) => {
    const j = ev.toJSON();
    const exposureRelation = resolveExposureRelation(j, referenceExamDate);
    const qualityWarnings = [];
    if (!j.eventDate) qualityWarnings.push('缺少 event_date');
    if (j.status === EVENT_STATUS.REGISTERED_NO_SCORE && j.rawScore != null) {
      qualityWarnings.push('registered_no_score 不應有分數');
    }
    return {
      eventId: String(j.id),
      eventType: j.eventType?.replace('_event', '') || j.eventType,
      lane: laneForEventType(j.eventType),
      eventDate: j.eventDate,
      semIndex: j.semIndex,
      termLabel: resolveTimelineTermLabel(j, enrollmentTerm),
      title: j.title,
      subtitle: j.subtitle,
      status: j.status,
      instrument: j.instrument,
      skill: j.skill,
      rawScore: j.rawScore,
      cefrLevel: j.cefrLevel,
      isB2Plus: getCefrRank(j.cefrLevel) != null && getCefrRank(j.cefrLevel) >= B2_RANK,
      hours: j.hours,
      exposureRelation,
      excludeFlag: j.excludeFlag,
      reasonCode: j.reasonCode,
      badges: buildBadges(j, exposureRelation),
      qualityWarnings,
    };
  });

  const retestFlag = !!analyticStudent?.retestFlag;
  const warnings = [];
  if (!retestFlag && analyticStudent?.hasValidExam) {
    warnings.push({
      code: 'NO_RETEST',
      message: '此學生無後測，無法判斷個人增益（true gain）。可用入學起點作分層或共變項，但不可把單次英檢當作前後測。',
    });
  }

  const meta = parseSnapshotVersion(snapshotVersion);
  return {
    student: {
      studentId: sid,
      name: studentRow?.nameZh || roster?.studentName || sid,
      department: analyticStudent?.department || roster?.department || studentRow?.departmentName,
      cohort: analyticStudent?.cohort || null,
      enrollmentTerm,
      baseline: {
        score: analyticStudent?.baselineEnglishScore ?? null,
        level: analyticStudent?.baselineLevel ?? null,
        cefr: analyticStudent?.baselineCefr ?? null,
      },
      currentStatus: {
        bestCefr: analyticStudent?.bestCefr || null,
        isB2plus: !!analyticStudent?.isB2plus,
        retestFlag,
        examCount: analyticStudent?.examCount || 0,
        exposureLevel: analyticStudent?.exposureLevel || null,
      },
    },
    timeline,
    meta: {
      snapshotVersion,
      ruleVersion: meta.ruleVersion,
      derivedAt: analyticStudent?.derivedAt || null,
      warnings,
    },
  };
}

module.exports = {
  getStudentTimeline,
  resolveLatestSnapshotVersion,
};
