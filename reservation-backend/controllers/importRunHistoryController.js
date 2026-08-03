'use strict';

const {
  listImportRuns,
  getImportRunDetail,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} = require('../services/importRunHistoryService');
const {
  deleteImportRun,
  auditDeleteImportRun,
} = require('../services/importRunDeleteService');

async function getImportRuns(req, res, next) {
  try {
    const data = await listImportRuns(req.query || {});
    return res.json({
      success: true,
      data: {
        items: data.items,
        pagination: data.pagination,
      },
      warnings: data.warnings || [],
      meta: {
        defaultLimit: DEFAULT_LIMIT,
        maxLimit: MAX_LIMIT,
      },
      requestId: req.requestId || null,
    });
  } catch (error) {
    return next(error);
  }
}

async function getImportRunDetailHandler(req, res, next) {
  try {
    const { source, sourceId } = req.params || {};
    const result = await getImportRunDetail(source, sourceId);
    if (!result || result.ok !== true) {
      return res.status(result?.status || 400).json({
        success: false,
        error: result?.error || '無法取得匯入明細',
        requestId: req.requestId || null,
      });
    }
    return res.json({
      success: true,
      data: result.detail,
      requestId: req.requestId || null,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteImportRunHandler(req, res, next) {
  try {
    const { source, sourceId } = req.params || {};
    const result = await deleteImportRun(source, sourceId);
    if (!result || result.ok !== true) {
      return res.status(result?.status || 400).json({
        success: false,
        error: result?.error || '無法刪除匯入紀錄',
        requestId: req.requestId || null,
      });
    }

    auditDeleteImportRun(req, {
      source,
      sourceId,
      module: result.data?.importType?.startsWith('bestep') ? 'bestep' : 'import_center',
      summary: `delete ${source}:${sourceId}`,
      data: result.data,
    });

    return res.json({
      success: true,
      data: result.data,
      requestId: req.requestId || null,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getImportRuns,
  getImportRunDetail: getImportRunDetailHandler,
  deleteImportRun: deleteImportRunHandler,
};
