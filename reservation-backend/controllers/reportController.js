// controllers/reportController.js
const reportService = require('../services/reportService');
const {
  buildEearsReportBasename,
  buildContentDispositionAttachment,
} = require('../utils/reportExportFilename');
const { logExportAudit, estimateReportRowCount } = require('../utils/exportAudit');

function resolveFormat(req) {
  const format = String(req.query.format || 'pdf').toLowerCase();
  if (format === 'xlsx' || format === 'excel') return 'xlsx';
  return 'pdf';
}

function sendReportBuffer(res, basenameWithoutExtension, format, buffer) {
  const ext = format === 'xlsx' ? 'xlsx' : 'pdf';
  if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else {
    res.setHeader('Content-Type', 'application/pdf');
  }
  res.setHeader('Content-Disposition', buildContentDispositionAttachment(basenameWithoutExtension, ext));
  res.send(buffer);
}

async function getClassReport(req, res, next) {
  try {
    const classId = parseInt(req.params.classId, 10);
    const semester = String(req.query.semester || '').trim();
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const fromSemester = req.query.fromSemester ? String(req.query.fromSemester).trim() : semester;
    const toSemester = req.query.toSemester ? String(req.query.toSemester).trim() : semester;
    const format = resolveFormat(req);

    const data = await reportService.buildClassReportData(classId, semester, fromSemester, toSemester);
    const buffer = format === 'xlsx'
      ? await reportService.generateExcelReport(data)
      : await reportService.generatePdfReport(data);

    const { basename } = buildEearsReportBasename({
      reportType: 'class',
      semester,
      classId: String(classId),
      ext: format,
    });
    logExportAudit(req, {
      module: 'reports',
      action: 'report_export_class',
      entityType: 'ClassReport',
      entityId: `class:${classId}:${semester}`,
      exportType: format,
      reportType: 'class',
      rowCount: estimateReportRowCount(data, 'class'),
      filters: { semester, fromSemester, toSemester, classId, format },
      fileName: basename,
    });
    await sendReportBuffer(res, basename, format, buffer);
  } catch (err) {
    if (String(err.message || '').includes('PDF engine not installed')) {
      return res.status(501).json({
        success: false,
        code: 'PDF_EXPORT_UNAVAILABLE',
        error: 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。',
        message: 'PDF export is not enabled; use Excel format.',
        requestId: req.requestId || undefined,
      });
    }
    next(err);
  }
}

async function getTeacherReport(req, res, next) {
  try {
    const teacherId = parseInt(req.params.teacherId, 10);
    const semester = String(req.query.semester || '').trim();
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const fromSemester = req.query.fromSemester ? String(req.query.fromSemester).trim() : semester;
    const toSemester = req.query.toSemester ? String(req.query.toSemester).trim() : semester;
    const format = resolveFormat(req);

    const data = await reportService.buildTeacherReportData(teacherId, semester, fromSemester, toSemester);
    const buffer = format === 'xlsx'
      ? await reportService.generateExcelReport(data)
      : await reportService.generatePdfReport(data);

    const { basename } = buildEearsReportBasename({
      reportType: 'teacher-dashboard',
      semester,
      teacherId: String(teacherId),
      ext: format,
    });
    logExportAudit(req, {
      module: 'reports',
      action: 'report_export_teacher',
      entityType: 'TeacherReport',
      entityId: `teacher:${teacherId}:${semester}`,
      exportType: format,
      reportType: 'teacher',
      rowCount: estimateReportRowCount(data, 'teacher'),
      filters: { semester, fromSemester, toSemester, teacherId, format },
      fileName: basename,
    });
    await sendReportBuffer(res, basename, format, buffer);
  } catch (err) {
    if (String(err.message || '').includes('PDF engine not installed')) {
      return res.status(501).json({
        success: false,
        code: 'PDF_EXPORT_UNAVAILABLE',
        error: 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。',
        message: 'PDF export is not enabled; use Excel format.',
        requestId: req.requestId || undefined,
      });
    }
    next(err);
  }
}

async function getOverviewReport(req, res, next) {
  try {
    const semester = String(req.query.semester || '').trim();
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const fromSemester = req.query.fromSemester ? String(req.query.fromSemester).trim() : semester;
    const toSemester = req.query.toSemester ? String(req.query.toSemester).trim() : semester;
    const format = resolveFormat(req);

    const data = await reportService.buildOverviewReportData(semester, fromSemester, toSemester);
    const buffer = format === 'xlsx'
      ? await reportService.generateExcelReport(data)
      : await reportService.generatePdfReport(data);

    const { basename } = buildEearsReportBasename({
      reportType: 'overview',
      semester,
      ext: format,
    });
    logExportAudit(req, {
      module: 'reports',
      action: 'report_export_overview',
      entityType: 'OverviewReport',
      entityId: `overview:${semester}`,
      exportType: format,
      reportType: 'overview',
      rowCount: estimateReportRowCount(data, 'overview'),
      filters: { semester, fromSemester, toSemester, format },
      fileName: basename,
    });
    await sendReportBuffer(res, basename, format, buffer);
  } catch (err) {
    if (String(err.message || '').includes('PDF engine not installed')) {
      return res.status(501).json({
        success: false,
        code: 'PDF_EXPORT_UNAVAILABLE',
        error: 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。',
        message: 'PDF export is not enabled; use Excel format.',
        requestId: req.requestId || undefined,
      });
    }
    next(err);
  }
}

async function getHighRiskReport(req, res, next) {
  try {
    const semester = String(req.query.semester || '').trim();
    if (!semester) return res.status(400).json({ error: '請提供 query: semester' });
    const format = resolveFormat(req);
    if (format !== 'xlsx') {
      return res.status(501).json({
        success: false,
        code: 'PDF_EXPORT_UNAVAILABLE',
        error: 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。',
        message: 'PDF export is not enabled; use Excel format.',
        requestId: req.requestId || undefined,
      });
    }

    const data = await reportService.buildHighRiskReportData(semester);
    const buffer = await reportService.generateExcelReport(data);

    const { basename } = buildEearsReportBasename({
      reportType: 'high-risk',
      semester,
      ext: 'xlsx',
    });
    logExportAudit(req, {
      module: 'reports',
      action: 'report_export_high_risk',
      entityType: 'HighRiskReport',
      entityId: `high-risk:${semester}`,
      exportType: 'xlsx',
      reportType: 'high-risk',
      rowCount: estimateReportRowCount(data, 'high-risk'),
      filters: { semester, format: 'xlsx' },
      fileName: basename,
    });
    await sendReportBuffer(res, basename, format, buffer);
  } catch (err) {
    if (err?.code === 'EXPORT_TOO_LARGE' || String(err.message || '').includes('EXPORT_TOO_LARGE')) {
      return res.status(413).json({
        success: false,
        code: 'EXPORT_TOO_LARGE',
        error: String(err.message || '').replace(/^EXPORT_TOO_LARGE:\s*/, '') || '匯出資料量過大',
        requestId: req.requestId || undefined,
      });
    }
    if (String(err.message || '').includes('PDF engine not installed')) {
      return res.status(501).json({
        success: false,
        code: 'PDF_EXPORT_UNAVAILABLE',
        error: 'PDF 匯出目前尚未啟用，請先使用 Excel 匯出。',
        message: 'PDF export is not enabled; use Excel format.',
        requestId: req.requestId || undefined,
      });
    }
    next(err);
  }
}

module.exports = {
  getClassReport,
  getTeacherReport,
  getOverviewReport,
  getHighRiskReport,
};
