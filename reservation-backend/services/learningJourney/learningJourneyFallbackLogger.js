'use strict';

const { logSystemAsync } = require('../systemLogService');
const { formatTaipeiTime } = require('../../utils/time');

const MAX_RECENT = 200;
const recentFallbacks = [];

function nowIso() {
  return formatTaipeiTime();
}

function asBool(v) {
  return !!v;
}

function pushRecent(entry) {
  recentFallbacks.unshift(entry);
  if (recentFallbacks.length > MAX_RECENT) recentFallbacks.length = MAX_RECENT;
}

function buildSection({ key, canonicalSource, covered, fallbackSources = [], reason = '' }) {
  const fallbackUsed = !covered && fallbackSources.length > 0;
  return {
    key,
    canonicalSource,
    covered: asBool(covered),
    fallbackUsed,
    fallbackSources,
    status: covered ? 'covered' : fallbackUsed ? 'fallback' : 'missing',
    reason,
  };
}

function analyzeReadModelFallback(readModel) {
  const flags = (readModel && readModel.student && readModel.student.aggregateFlags) || {};
  const ljsProfiles = (readModel && readModel.student && readModel.student.ljsSemesterProfiles) || [];
  const ljsAttempts = (readModel && readModel.student && readModel.student.ljsExamAttempts) || [];
  const hasRawBestep = flags.hasBestepScores || flags.hasBestepAttendance;

  const sections = [
    buildSection({
      key: 'student_master',
      canonicalSource: 'students',
      covered: flags.hasLjsStudent,
      fallbackSources: flags.hasEtMaster ? ['et_student_master'] : [],
      reason: 'students 缺列時仍以 et_student_master 補足聚合頁基本資料',
    }),
    buildSection({
      key: 'semester_profiles',
      canonicalSource: 'student_semester_profiles',
      covered: ljsProfiles.length > 0,
      fallbackSources: flags.hasEnrollments ? ['et_enrollment_snapshots'] : [],
      reason: 'student_semester_profiles 尚未覆蓋時以 ET enrollment snapshot 顯示名冊資訊',
    }),
    buildSection({
      key: 'exam_attempts',
      canonicalSource: 'exam_attempts/exam_attempt_skill_scores',
      covered: ljsAttempts.length > 0,
      fallbackSources: [
        ...(flags.hasEtExamAttempts ? ['et_exam_attempts'] : []),
      ],
      reason: hasRawBestep
        ? 'BESTEP 原始匯入來源存在，若 canonical attempt 缺漏需執行 sync/migration'
        : 'canonical exam attempts 尚未覆蓋時以 legacy ET attempt/best-skill 快取輔助呈現',
    }),
    buildSection({
      key: 'activity_participations',
      canonicalSource: 'activity_participations',
      covered: flags.hasActivityParticipations,
      fallbackSources: flags.hasReservations ? ['reservations'] : [],
      reason: 'activity_participations 尚未覆蓋時以 reservation/checkin 營運資料輔助呈現',
    }),
    buildSection({
      key: 'course_records',
      canonicalSource: 'courses/course_enrollments/course_outcome_mappings',
      covered: flags.hasCourseEnrollments,
      fallbackSources: [],
      reason: '正式修課紀錄沒有 legacy fallback；不得以 classes/class_memberships 取代',
    }),
  ];

  const fallbackSections = sections.filter((s) => s.fallbackUsed);
  const missingSections = sections.filter((s) => s.status !== 'covered').map((s) => s.key);

  return {
    fallbackUsed: fallbackSections.length > 0,
    fallbackSources: [...new Set(fallbackSections.flatMap((s) => s.fallbackSources))],
    canonicalCoverage: {
      sections,
      coveredCount: sections.filter((s) => s.covered).length,
      totalCount: sections.length,
      coverageRate: sections.length ? Number((sections.filter((s) => s.covered).length / sections.length).toFixed(4)) : 0,
    },
    canonicalMissingSections: missingSections,
    fallbackWarnings: fallbackSections.map((s) => `${s.key}: 使用 ${s.fallbackSources.join(', ')}；${s.reason}`),
  };
}

function logFallbackUsage(payload = {}) {
  const entry = {
    loggedAt: nowIso(),
    requestId: payload.requestId || '',
    semesterId: payload.semesterId || '',
    studentId: payload.studentId || '',
    module: payload.module || 'learning_journey',
    api: payload.api || '',
    canonicalSource: payload.canonicalSource || '',
    fallbackSource: payload.fallbackSource || '',
    reason: payload.reason || '',
    severity: payload.severity || 'warning',
  };
  pushRecent(entry);

  const message = JSON.stringify(entry);
  console.warn(`[learning-journey-fallback] ${message}`);
  if (entry.requestId) {
    logSystemAsync({
      requestId: entry.requestId,
      type: 'lj_fallback',
      method: 'READ',
      path: entry.api,
      status: entry.severity === 'error' ? 500 : 200,
      errorMessage: message,
    });
  }
  return entry;
}

function observeReadModelFallback(readModel, context = {}) {
  const analysis = analyzeReadModelFallback(readModel);
  if (!analysis.fallbackUsed) return analysis;

  logFallbackUsage({
    requestId: context.requestId,
    semesterId: context.semesterId,
    studentId: context.studentId,
    module: context.module || 'learning_journey_read_model',
    api: context.api,
    canonicalSource: analysis.canonicalCoverage.sections
      .filter((s) => s.fallbackUsed)
      .map((s) => s.canonicalSource)
      .join(','),
    fallbackSource: analysis.fallbackSources.join(','),
    reason: analysis.fallbackWarnings.join(' | '),
    severity: 'warning',
  });

  return analysis;
}

function getFallbackGovernanceSummary(semesterId) {
  const sid = semesterId ? String(semesterId).trim() : '';
  const rows = recentFallbacks.filter((r) => !sid || !r.semesterId || r.semesterId === sid);
  const byModule = {};
  for (const row of rows) {
    const key = row.module || 'unknown';
    byModule[key] = (byModule[key] || 0) + 1;
  }
  return {
    source: 'process_memory_system_log_async',
    fallbackUsageCount: rows.length,
    fallbackByModule: byModule,
    fallbackWarnings: rows.slice(0, 10),
  };
}

module.exports = {
  analyzeReadModelFallback,
  observeReadModelFallback,
  logFallbackUsage,
  getFallbackGovernanceSummary,
};
