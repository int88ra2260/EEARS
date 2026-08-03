'use strict';

const { rebuildSemesterBestSkills } = require('../englishTestTracking/semesterBestSkillService');
const { getLearningJourneyV3SemesterHealth } = require('./learningJourneyV3HealthService');
const auditLogService = require('../auditLogService');
const operationRuns = require('./learningJourneyOperationRunService');

function pickSummary(health) {
  const summary = health?.summary || {};
  return {
    status: summary.status || 'unknown',
    activeRosterCount: Number(summary.activeRosterCount || 0),
    studentsWithBestSkillProjection: Number(summary.studentsWithBestSkillProjection || 0),
    studentsWithExamAttempts: Number(summary.studentsWithExamAttempts || 0)
  };
}

function buildDiff(beforeHealth, afterHealth) {
  const beforeSummary = pickSummary(beforeHealth);
  const afterSummary = pickSummary(afterHealth);
  const beforeWarnings = Array.isArray(beforeHealth?.warnings) ? beforeHealth.warnings.length : 0;
  const afterWarnings = Array.isArray(afterHealth?.warnings) ? afterHealth.warnings.length : 0;
  return {
    studentsWithBestSkillProjectionDelta:
      afterSummary.studentsWithBestSkillProjection - beforeSummary.studentsWithBestSkillProjection,
    statusChanged: beforeSummary.status !== afterSummary.status,
    statusBefore: beforeSummary.status,
    statusAfter: afterSummary.status,
    warningsDelta: afterWarnings - beforeWarnings
  };
}

function executedByFromUser(user) {
  if (!user) return { id: null, username: null };
  return {
    id: user.id == null ? null : String(user.id),
    username: user.user || user.username || user.name || null
  };
}

async function rebuildLearningJourneyV3Semester(semesterIdRaw, opts = {}) {
  const semesterId = String(semesterIdRaw || '').trim();
  if (!semesterId) {
    const err = new Error('semesterId 必填');
    err.status = 400;
    throw err;
  }
  if (opts.confirm !== true) {
    const err = new Error('請先確認後再執行 rebuild');
    err.status = 400;
    throw err;
  }
  if (opts.dryRun !== false) {
    const err = new Error('目前僅支援 dryRun=false 的人工 rebuild');
    err.status = 400;
    throw err;
  }

  const startedAt = new Date();
  const warnings = [];
  let run = null;
  try {
    run = await operationRuns.createRun({
      operationType: operationRuns.OPERATION_TYPES.REBUILD_BEST_SKILL_PROJECTION,
      semesterId,
      requestId: opts.requestId || null,
      user: opts.user,
      source: opts.source || 'dashboard',
      dryRun: false,
      confirm: true,
      startedAt
    });
  } catch (err) {
    warnings.push({
      code: 'OPERATION_RUN_CREATE_FAILED',
      message: 'operation run 建立失敗；rebuild 仍會繼續執行。',
      detail: err?.message || String(err)
    });
  }

  let before = null;
  let rebuildResult = null;
  let analyticsRebuild = null;
  try {
    before = await getLearningJourneyV3SemesterHealth(semesterId, { includeActions: false });
    rebuildResult = await rebuildSemesterBestSkills(semesterId);
    try {
      const { rebuildAnalyticsInBatches } = require('./analytics/analyticRebuildService');
      const { resolveSemesterStudentIds } = require('./analytics/analyticStudentIdResolver');
      const { buildSnapshotVersion } = require('./utils/snapshotVersion');
      const semesterStudentIds = await resolveSemesterStudentIds(semesterId);
      analyticsRebuild = await rebuildAnalyticsInBatches({
        scope: semesterId,
        semesterId,
        studentIds: semesterStudentIds.length ? semesterStudentIds : undefined,
        snapshotVersion: buildSnapshotVersion({ scope: semesterId, cutoffAt: new Date(), sequence: 1 }),
        batchSize: 50,
      });
    } catch (analyticsErr) {
      warnings.push({
        code: 'ANALYTICS_REBUILD_FAILED',
        message: 'best-skill projection 已重建，但 analytic 衍生層重建失敗。',
        detail: analyticsErr?.message || String(analyticsErr),
      });
    }
  } catch (err) {
    if (run) {
      await operationRuns.markFailed(run, {
        finishedAt: new Date(),
        beforeSummary: before ? pickSummary(before) : null,
        warnings,
        errorCode: err?.code || 'REBUILD_FAILED',
        errorMessage: err?.message || String(err)
      }).catch(() => {});
    }
    throw err;
  }

  let after = null;
  try {
    after = await getLearningJourneyV3SemesterHealth(semesterId, { includeActions: false });
  } catch (err) {
    warnings.push({
      code: 'AFTER_HEALTH_UNAVAILABLE',
      message: 'rebuild 已完成，但 after health 檢查失敗；請重新整理資料健康檢查。',
      detail: err?.message || String(err)
    });
  }

  const finishedAt = new Date();
  const data = {
    operationRunId: run?.id || null,
    semesterId,
    operation: 'REBUILD_BEST_SKILL_PROJECTION',
    status: 'success',
    requestId: opts.requestId || null,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    executedBy: executedByFromUser(opts.user),
    dryRun: false,
    before: {
      summary: pickSummary(before),
      warnings: Array.isArray(before?.warnings) ? before.warnings : []
    },
    after: after
      ? {
        summary: pickSummary(after),
        warnings: Array.isArray(after?.warnings) ? after.warnings : []
      }
      : null,
    diff: after ? buildDiff(before, after) : null,
    rebuildResult,
    analyticsRebuild,
    warnings
  };

  if (run) {
    await operationRuns.markSuccess(run, {
      finishedAt,
      durationMs: data.durationMs,
      beforeSummary: data.before.summary,
      afterSummary: data.after ? data.after.summary : null,
      diffSummary: data.diff,
      resultSummary: rebuildResult,
      warnings
    }).catch(() => {});
  }

  try {
    auditLogService.logAuditAsync({
      module: 'learning_journey',
      action: 'rebuild_v3_best_skill_projection',
      entityType: 'EtSemesterStudentBestSkill',
      entityId: semesterId,
      targetSummary: `Learning Journey V3 rebuild projection ${semesterId}`,
      beforeData: data.before,
      afterData: {
        after: data.after,
        diff: data.diff,
        rebuildResult
      },
      changeReason: opts.reason || 'MANUAL_REBUILD_FROM_HEALTH_CARD',
      req: opts.req,
      requestId: opts.requestId
    });
  } catch (_) {
    // audit logging is best-effort and must not fail the rebuild workflow
  }

  return data;
}

module.exports = {
  rebuildLearningJourneyV3Semester
};
