'use strict';

const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const {
  EnglishLearningPassport,
  EnglishLearningSubmission,
  EnglishLearningPointRule,
} = require('../../models');
const { SUBMISSION_STATUS } = require('./constants');
const { logExportAudit } = require('../../utils/exportAudit');
const { buildEearsReportBasename, buildContentDispositionAttachment } = require('../../utils/reportExportFilename');

async function buildExportWorkbook(filters = {}) {
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.studentId) where.studentId = { [Op.like]: `%${filters.studentId}%` };

  const passports = await EnglishLearningPassport.findAll({
    where,
    order: [['studentId', 'ASC']],
  });

  const rules = await EnglishLearningPointRule.findAll({ order: [['sortOrder', 'ASC']] });
  const ruleCodes = rules.map((r) => r.code);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('英語實踐歷程護照');

  const headers = [
    '學號', '姓名', 'Email', '護照狀態', '累計核准點數',
    '最終認證狀態', '最終認證時間', '最近審核時間',
    ...ruleCodes.map((c) => {
      const rule = rules.find((r) => r.code === c);
      return rule ? `${rule.name}點數` : c;
    }),
  ];
  sheet.addRow(headers);

  for (const passport of passports) {
    const approved = await EnglishLearningSubmission.findAll({
      where: { passportId: passport.id, status: SUBMISSION_STATUS.APPROVED },
      attributes: ['ruleCode', 'pointsApproved', 'reviewedAt'],
    });

    const byRule = {};
    let lastReviewedAt = passport.reviewedAt;
    approved.forEach((s) => {
      byRule[s.ruleCode] = (byRule[s.ruleCode] || 0) + (s.pointsApproved || 0);
      if (s.reviewedAt && (!lastReviewedAt || s.reviewedAt > lastReviewedAt)) {
        lastReviewedAt = s.reviewedAt;
      }
    });

    const certReviewed = passport.certificationReviewedAt || passport.completedAt;

    sheet.addRow([
      passport.studentId,
      passport.studentName,
      passport.studentEmail,
      passport.status,
      passport.totalApprovedPoints,
      passport.certificationStatus,
      certReviewed ? certReviewed.toISOString().slice(0, 10) : '',
      lastReviewedAt ? lastReviewedAt.toISOString().slice(0, 10) : '',
      ...ruleCodes.map((c) => byRule[c] || 0),
    ]);
  }

  sheet.getRow(1).font = { bold: true };
  return { workbook, rowCount: passports.length };
}

async function exportPassportsXlsx(filters, req) {
  const { workbook, rowCount } = await buildExportWorkbook(filters);
  const { basename, ext } = buildEearsReportBasename({ reportType: 'overview', semester: 'elp', ext: 'xlsx' });
  const fileName = `${basename}.${ext}`;
  const buffer = await workbook.xlsx.writeBuffer();

  logExportAudit(req, {
    module: 'english_learning_passport',
    action: 'export_passports',
    entityType: 'EnglishLearningPassportExport',
    entityId: 'bulk',
    exportType: 'xlsx',
    rowCount,
    filters,
    fileName,
  });

  return { buffer, fileName, contentDisposition: buildContentDispositionAttachment(basename, ext) };
}

module.exports = {
  exportPassportsXlsx,
};
