'use strict';

const {
  LjStudentEvent,
  LjAnalyticStudent,
  CourseEnrollment,
  ActivityParticipation,
  EtExamAttempt,
} = require('../../../models');
const { EVENT_TYPES } = require('../../../constants/learningJourneyEventConstants');
const { buildSnapshotVersion } = require('../utils/snapshotVersion');
const { projectAllEvents, normSid } = require('./eventProjectorService');
const { rebuildAnalytics } = require('./analyticRebuildService');

async function resolveLatestSnapshotVersion() {
  const row = await LjAnalyticStudent.findOne({
    attributes: ['snapshotVersion'],
    order: [['derivedAt', 'DESC']],
  });
  return row?.snapshotVersion || buildSnapshotVersion();
}

async function countOperationalSignals(studentId) {
  const sid = normSid(studentId);
  const [courses, activities, exams] = await Promise.all([
    CourseEnrollment.count({ where: { studentId: sid } }),
    ActivityParticipation.count({ where: { studentId: sid } }),
    EtExamAttempt.count({ where: { studentId: sid, status: 'valid' } }),
  ]);
  return courses + activities + exams;
}

/**
 * 若 operational 表已有資料但 lj_student_events 缺漏，回傳 true。
 */
async function studentNeedsEventProjection(studentId) {
  const sid = normSid(studentId);
  if (!sid) return false;

  const operational = await countOperationalSignals(sid);
  if (operational === 0) return false;

  const eventCount = await LjStudentEvent.count({ where: { studentId: sid } });
  if (eventCount === 0) return true;

  const [courseEnrollments, courseEvents, activityRows, activityEvents] = await Promise.all([
    CourseEnrollment.count({ where: { studentId: sid } }),
    LjStudentEvent.count({ where: { studentId: sid, eventType: EVENT_TYPES.COURSE } }),
    ActivityParticipation.count({ where: { studentId: sid } }),
    LjStudentEvent.count({ where: { studentId: sid, eventType: EVENT_TYPES.ACTIVITY } }),
  ]);

  if (courseEnrollments > 0 && courseEvents === 0) return true;
  if (activityRows > 0 && activityEvents === 0) return true;
  return false;
}

/**
 * 讀取前確保單一學生的事件投影與（必要時）分析衍生列已就緒。
 * 修課匯入後的背景 rebuild 可能尚未完成，此函式補上 on-read 同步。
 *
 * @param {string} studentId
 * @param {{ force?: boolean, ensureAnalyticRow?: boolean, snapshotVersion?: string }} [opts]
 */
async function ensureStudentAnalyticsReady(studentId, opts = {}) {
  const sid = normSid(studentId);
  if (!sid) {
    return { studentId: sid, skipped: true, reason: 'invalid_student_id' };
  }

  const needsProjection = opts.force === true || await studentNeedsEventProjection(sid);
  let projectResult = null;
  if (needsProjection) {
    projectResult = await projectAllEvents({ studentIds: [sid] });
  }

  let rebuilt = false;
  let rebuildResult = null;
  if (opts.ensureAnalyticRow !== false) {
    const snapshotVersion = opts.snapshotVersion || await resolveLatestSnapshotVersion();
    const existing = await LjAnalyticStudent.findOne({
      where: { studentId: sid, snapshotVersion },
    });
    const operational = await countOperationalSignals(sid);
    if (!existing && operational > 0) {
      rebuildResult = await rebuildAnalytics({
        studentIds: [sid],
        scope: 'student',
        snapshotVersion,
      });
      rebuilt = true;
    }
  }

  return {
    studentId: sid,
    projected: needsProjection,
    projectResult,
    rebuilt,
    rebuildResult,
  };
}

module.exports = {
  ensureStudentAnalyticsReady,
  studentNeedsEventProjection,
  resolveLatestSnapshotVersion,
};
