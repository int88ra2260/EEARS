const { runStage } = require('./migrationCommonService');
const { syncActivitiesToActivityParticipations } = require('../syncService');

async function migrateActivities(batchContext) {
  return runStage('activity_participations', batchContext, async (ctx) => {
    if (ctx.options && ctx.options.simulateFailureStage === 'activity_participations') {
      throw new Error('Simulated failure in activity_participations stage');
    }
    const semesterId = String(
      (ctx.options && ctx.options.semesterId)
      || ctx.semesterId
      || (ctx.options && ctx.options.scope && ctx.options.scope.semesterId)
      || ''
    ).trim();
    if (!semesterId) {
      return {
        stats: {
          processed: 0,
          inserted: 0,
          updated: 0,
          skipped: 0,
          duplicate: 0,
          quarantined: 0,
          errors: 1,
          warnings: 1
        },
        message: 'activity participation migration skipped: semesterId missing',
        payload: { reason: 'SEMESTER_ID_REQUIRED' }
      };
    }
    const result = await syncActivitiesToActivityParticipations({
      semesterId,
      dryRun: Boolean(ctx.dryRun)
    });
    const processed = Number(result.inserted || 0) + Number(result.updated || 0) + Number(result.skipped || 0);
    return {
      stats: {
        processed,
        inserted: Number(result.inserted || 0),
        updated: Number(result.updated || 0),
        skipped: Number(result.skipped || 0),
        duplicate: 0,
        quarantined: 0,
        errors: Array.isArray(result.errors) ? result.errors.length : 0,
        warnings: 0
      },
      message: `activity participations migrated from reservations for ${semesterId}`,
      payload: {
        semesterId,
        errors: result.errors || []
      }
    };
  });
}

module.exports = {
  migrateActivities
};
