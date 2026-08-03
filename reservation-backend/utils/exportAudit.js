const auditLogService = require('../services/auditLogService');

/**
 * 資料匯出稽核（metadata 經 auditLogService → sanitizeForAudit；不含匯出列資料）
 */
function logExportAudit(req, {
  module,
  action,
  entityType = 'DataExport',
  entityId,
  exportType = 'xlsx',
  reportType = null,
  rowCount = null,
  filters = {},
  fileName = null,
}) {
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  auditLogService.logAuditAsync({
    module: String(module || 'export').slice(0, 80),
    action: String(action || 'export').slice(0, 64),
    entityType: String(entityType || 'DataExport').slice(0, 80),
    entityId: String(entityId != null ? entityId : 'export').slice(0, 64),
    targetSummary: `${action || 'export'} type=${exportType} count=${rowCount != null ? rowCount : 'n/a'}`,
    afterData: {
      exportType,
      reportType: reportType != null ? String(reportType).slice(0, 64) : null,
      rowCount: rowCount != null ? Number(rowCount) : null,
      filters: safeFilters,
      fileName: fileName != null ? String(fileName).slice(0, 120) : null,
      requestId: req?.requestId || null,
    },
    req,
  });
}

function estimateReportRowCount(data, reportType) {
  if (!data) return null;
  switch (reportType) {
    case 'class':
      return data.highRisks?.length
        ?? data.summary?.bestepOverview?.students?.length
        ?? null;
    case 'teacher':
      return data.dashboard?.classes?.length ?? null;
    case 'overview':
      return data.overview?.totalStudents
        ?? data.overview?.classCount
        ?? null;
    case 'high-risk':
      return data.risks?.length ?? null;
    default:
      return null;
  }
}

module.exports = {
  logExportAudit,
  estimateReportRowCount,
};
