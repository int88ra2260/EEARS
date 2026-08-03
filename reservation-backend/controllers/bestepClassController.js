// controllers/bestepClassController.js
const { Class } = require('../models');
const { getClassBestepOverview, buildClassBestepExportData } = require('../services/bestepClassService');
const { writeClassBestepExportWorkbook } = require('../services/bestepClassExportExcel');
const {
  assertCanAccessClass,
  sendClassScopeDenied,
} = require('../services/accessControl/classScopeGuard');
const { logExportAudit } = require('../utils/exportAudit');

function sanitizeFileName(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    // 移除可能導致 HTTP header 失敗的控制字元
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * 取得班級 BESTEP 概況
 * GET /api/admin/classes/:classId/bestep-overview
 */
async function getBestepOverview(req, res, next) {
  try {
    const { classId } = req.params;
    const { semester, examType = 'all', page = 1, pageSize = 50, search = '' } = req.query;

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    const numericClassId = parseInt(classId, 10);
    if (!numericClassId || isNaN(numericClassId)) {
      return res.status(400).json({ error: 'ç„¡æ•ˆçš„ç­ç´šID' });
    }

    const classRecord = await Class.findByPk(numericClassId);
    if (!classRecord) {
      return res.status(404).json({ error: 'æ‰¾ä¸åˆ°ç­ç´š' });
    }

    try {
      await assertCanAccessClass(req.user, classRecord);
    } catch (scopeErr) {
      return sendClassScopeDenied(res, scopeErr);
    }

    const result = await getClassBestepOverview(
      numericClassId,
      semester,
      examType,
      {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        search: search.trim()
      }
    );

    res.json(result);
  } catch (error) {
    console.error('取得班級 BESTEP 概況錯誤:', error);
    res.status(500).json({ error: error.message || '載入資料失敗' });
  }
}

/**
 * 匯出班級 BESTEP 概況 Excel
 * GET /api/admin/classes/:classId/bestep-overview/export?semester=114-1&examType=all&search=
 */
async function exportClassBestepOverview(req, res, next) {
  try {
    const { classId } = req.params;
    const { semester, examType = 'all', search = '' } = req.query;

    if (!semester) {
      return res.status(400).json({ error: '請指定學期' });
    }

    const numericClassId = parseInt(classId, 10);
    if (!numericClassId || isNaN(numericClassId)) {
      return res.status(400).json({ error: '無效的班級ID' });
    }

    const classRecord = await Class.findByPk(numericClassId);
    if (!classRecord) {
      return res.status(404).json({ error: '找不到班級' });
    }

    // 老師僅能匯出自己的班級（與班級明細匯出一致的權限檢查方式）
    try {
      await assertCanAccessClass(req.user, classRecord);
    } catch (scopeErr) {
      return sendClassScopeDenied(res, scopeErr);
    }

    const exportData = await buildClassBestepExportData(numericClassId, semester, examType, {
      search: String(search || '').trim()
    });

    const workbook = writeClassBestepExportWorkbook(exportData);

    const dateStr = new Date().toISOString().split('T')[0];
    const safeClassName = sanitizeFileName(exportData.classInfo?.className || classRecord.name || `class-${classId}`);
    const fileName = `班級參與概況_BESTEP_${safeClassName}_${dateStr}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // 使用 filename*（UTF-8）+ filename（encode 後）確保 Node 不會因中文/特殊字元報錯
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`
    );

    await workbook.xlsx.write(res);

    logExportAudit(req, {
      module: 'bestep',
      action: 'bestep_class_export',
      entityType: 'BestepClassExport',
      entityId: `class:${numericClassId}:${semester}`,
      exportType: 'xlsx',
      reportType: 'bestep_class',
      rowCount: (exportData.rows || []).length,
      filters: { semester, examType, classId: numericClassId, search: String(search || '').trim() || null },
      fileName,
    });

    res.end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getBestepOverview,
  exportClassBestepOverview
};
