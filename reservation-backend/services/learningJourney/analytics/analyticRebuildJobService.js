'use strict';

const {
  rebuildAnalytics,
  rebuildAnalyticsInBatches,
} = require('./analyticRebuildService');
const operationRuns = require('../learningJourneyOperationRunService');

let activeRebuildPromise = null;

function shouldRunAsync(opts = {}) {
  if (opts.async === true) return true;
  if (opts.async === false) return false;

  const scope = String(opts.scope || 'global').trim().toLowerCase();
  if (scope === 'global') return true;
  if (scope === 'semester' || opts.semesterId) return true;

  const count = Array.isArray(opts.studentIds) ? opts.studentIds.length : 0;
  return count > 20;
}

async function findRunningRebuildRun() {
  return operationRuns.findRunningByType(operationRuns.OPERATION_TYPES.REBUILD_ANALYTICS);
}

async function runAnalyticsRebuildJob(opts = {}) {
  const run = opts._existingRun || await operationRuns.createRun({
    operationType: operationRuns.OPERATION_TYPES.REBUILD_ANALYTICS,
    semesterId: opts.semesterId || null,
    requestId: opts.requestId || null,
    user: opts.user,
    source: opts.source || 'api',
    confirm: opts.confirm === true,
    startedAt: new Date(),
  });

  try {
    const data = await rebuildAnalyticsInBatches({
      scope: opts.scope || 'global',
      semesterId: opts.semesterId,
      studentIds: opts.studentIds,
      batchSize: opts.batchSize,
      cutoffAt: opts.cutoffAt,
      continueOnError: false,
      onBatch: async (progress) => {
        await operationRuns.updateProgress(run, {
          resultSummary: {
            phase: 'rebuilding',
            totalStudents: progress.totalStudents,
            completedBatches: progress.completedBatches,
            batchCount: progress.batchCount,
          },
        });
      },
    });

    await operationRuns.markSuccess(run, {
      finishedAt: new Date(),
      resultSummary: {
        snapshotVersion: data.snapshotVersion,
        totalStudents: data.totalStudents,
        eventCount: data.eventCount,
        analyticStudentCount: data.analyticStudentCount,
        analyticExamCount: data.analyticExamCount,
        progress: data.progress,
      },
    });

    return { run, data };
  } catch (err) {
    await operationRuns.markFailed(run, {
      finishedAt: new Date(),
      errorCode: 'ANALYTICS_REBUILD_FAILED',
      errorMessage: err?.message || String(err),
      resultSummary: err?.progress || null,
    }).catch(() => {});
    throw err;
  }
}

async function startAnalyticsRebuildJob(opts = {}) {
  const running = await findRunningRebuildRun();
  if (running || activeRebuildPromise) {
    return {
      alreadyRunning: true,
      run: running,
    };
  }

  const run = await operationRuns.createRun({
    operationType: operationRuns.OPERATION_TYPES.REBUILD_ANALYTICS,
    semesterId: opts.semesterId || null,
    requestId: opts.requestId || null,
    user: opts.user,
    source: opts.source || 'api',
    confirm: opts.confirm === true,
    startedAt: new Date(),
  });

  activeRebuildPromise = runAnalyticsRebuildJob({
    ...opts,
    _existingRun: run,
  }).finally(() => {
    activeRebuildPromise = null;
  });

  return {
    alreadyRunning: false,
    run,
    async: true,
  };
}

async function runAnalyticsRebuildSync(opts = {}) {
  const studentIds = opts.studentIds;
  const count = Array.isArray(studentIds) ? studentIds.length : 0;
  if (count > 20 || String(opts.scope || '').toLowerCase() === 'global' || opts.semesterId) {
    return rebuildAnalyticsInBatches(opts);
  }
  return rebuildAnalytics(opts);
}

module.exports = {
  shouldRunAsync,
  findRunningRebuildRun,
  startAnalyticsRebuildJob,
  runAnalyticsRebuildSync,
  runAnalyticsRebuildJob,
};
