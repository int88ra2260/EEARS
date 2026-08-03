const { SurveyRepairRun, SurveyRepairRunItem } = require('../models');
const governance = require('./surveyDataGovernanceService');
const health = require('./surveyHealthService');
const legacySync = require('./surveyLegacyResponseSyncService');
const mappingService = require('./surveyAnswerMappingService');

function requireExecuteGuard(payload = {}) {
  const phrase = String(payload.confirmPhrase || '').trim();
  const confirmExecute = payload.confirmExecute === true;
  if (!confirmExecute || phrase !== 'EXECUTE_SURVEY_REPAIR') {
    const e = new Error('缺少執行確認：請提供 confirmExecute=true 且 confirmPhrase=EXECUTE_SURVEY_REPAIR');
    e.statusCode = 400;
    throw e;
  }
}

async function createRun({ repairType, mode, requestedBy, requestPayloadJson }) {
  return SurveyRepairRun.create({
    repairType,
    mode,
    status: 'pending',
    requestedBy: requestedBy || null,
    requestPayloadJson: requestPayloadJson || null,
  });
}

async function setRunStatus(run, status, extra = {}) {
  await run.update({ status, ...extra });
}

async function writeItems(runId, items = []) {
  for (const it of items) {
    // eslint-disable-next-line no-await-in-loop
    await SurveyRepairRunItem.create({
      runId,
      entityType: it.entityType || 'unknown',
      entityId: String(it.entityId || ''),
      actionType: it.actionType || 'inspect',
      beforeJson: it.beforeJson || null,
      afterJson: it.afterJson || null,
      resultStatus: it.resultStatus || 'skipped',
      message: it.message || null,
    });
  }
}

async function executeRepair(type, payload, user) {
  const mode = payload?.mode === 'execute' ? 'execute' : 'dry_run';
  if (mode === 'execute') requireExecuteGuard(payload);
  const dryRun = mode !== 'execute';
  const run = await createRun({
    repairType: type,
    mode,
    requestedBy: user?.id,
    requestPayloadJson: payload || {},
  });
  await setRunStatus(run, 'running', { startedAt: new Date() });

  try {
    let report;
    if (type === 'semester_backfill') {
      report = await governance.backfillEventSemesters({ dryRun });
      const responsePart = await governance.backfillResponseLinks({ dryRun });
      report.responsePart = responsePart;
    } else if (type === 'version_resolution') {
      report = await governance.backfillResponseLinks({ dryRun });
    } else if (type === 'answer_recheck') {
      report = await health.recheckAnswers({ dryRun });
    } else if (type === 'legacy_response_sync') {
      report = await legacySync.syncLegacyResponsesToModule({
        semester: payload.semester,
        dryRun,
      });
    } else if (type === 'bootstrap_answer_mappings') {
      report = await mappingService.bootstrapStandardAnswerMappings({
        surveyId: payload.surveyId || null,
        userId: user?.id,
        dryRun,
      });
    } else if (type === 'recommended_fix') {
      const eventReport = await governance.backfillEventSemesters({ dryRun });
      const responsePart = await governance.backfillResponseLinks({ dryRun });
      const mappings = await mappingService.bootstrapStandardAnswerMappings({
        userId: user?.id,
        dryRun,
      });
      report = { eventReport, responsePart, mappings };
    } else {
      throw new Error(`unsupported repair type: ${type}`);
    }

    const items = [];
    const unresolved = report.unresolvedEventIds || report.unresolvedResponseIds || report.responsePart?.unresolvedResponseIds || [];
    unresolved.slice(0, 100).forEach((id) => {
      items.push({
        entityType: type === 'semester_backfill' ? 'event_or_response' : 'response',
        entityId: id,
        actionType: type,
        resultStatus: 'skipped',
        message: 'unresolved/ambiguous',
      });
    });
    await writeItems(run.id, items);

    await setRunStatus(run, 'completed', {
      completedAt: new Date(),
      summaryJson: report,
      resultJson: report,
    });
    return await SurveyRepairRun.findByPk(run.id);
  } catch (e) {
    await setRunStatus(run, 'failed', {
      completedAt: new Date(),
      errorJson: { message: e.message },
    });
    throw e;
  }
}

async function previewRepair(type, payload, user) {
  return executeRepair(type, { ...payload, mode: 'dry_run' }, user);
}

async function listRepairRuns(query = {}) {
  const where = {};
  if (query.repairType) where.repairType = query.repairType;
  if (query.mode) where.mode = query.mode;
  if (query.status) where.status = query.status;
  return SurveyRepairRun.findAll({ where, order: [['id', 'DESC']], limit: 200 });
}

async function getRepairRunDetail(id) {
  const run = await SurveyRepairRun.findByPk(id);
  if (!run) return null;
  const items = await SurveyRepairRunItem.findAll({ where: { runId: id }, order: [['id', 'DESC']], limit: 1000 });
  return { run, items };
}

module.exports = {
  previewRepair,
  executeRepair,
  listRepairRuns,
  getRepairRunDetail,
};
