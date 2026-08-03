const auditLogService = require('../services/auditLogService');

/**
 * Legacy 問卷 Excel 匯出稽核（metadata 經 auditLogService → sanitizeForAudit，不含完整個資）。
 */
function logLegacySurveyExportAudit(req, {
  action,
  surveyType,
  rowCount,
  filters = {},
  surveyId = null,
}) {
  auditLogService.logAuditAsync({
    module: 'survey',
    action,
    entityType: 'LegacySurveyExport',
    entityId: `${surveyType}:${req.requestId || Date.now()}`.slice(0, 64),
    targetSummary: `legacy export type=${surveyType} count=${rowCount}`,
    afterData: {
      exportType: 'legacy_xlsx',
      surveyType,
      surveyId: surveyId != null ? String(surveyId).slice(0, 80) : null,
      rowCount: Number(rowCount) || 0,
      filters,
      requestId: req.requestId || null,
    },
    req,
  });
}

module.exports = {
  logLegacySurveyExportAudit,
};
