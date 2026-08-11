'use strict';

const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

const sequelize = require('../db');
const { SiteContentEntry, EnglishTestStudentIdCardRosterUpload, EnglishTestStudentIdCardRosterEntry } = require('../models');

const ROSTER_SECTION = 'english_test_registration';
const ROSTER_MISMATCH_CONTENT_KEY = 'englishTestRegistration.idCardMismatchMessage';

const DEFAULT_MISMATCH_PROMPT_ZH = [
  '您輸入的「學號」與「身分證字號」不匹配，請確認資料後重新填寫。',
  '如有疑問，請聯繫全英語卓越教學中心。',
].join('\n');

function normalizeStudentId(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeIdNumber(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isEmptyRow(row) {
  if (!Array.isArray(row)) return true;
  return row.every((c) => c == null || String(c).trim() === '');
}

async function getMismatchPromptZh() {
  // 輕量快取：避免每次查詢都打 DB
  const now = Date.now();
  if (getMismatchPromptZh._cache && now - getMismatchPromptZh._cache.at < 30_000) {
    return getMismatchPromptZh._cache.value;
  }

  const row = await SiteContentEntry.findOne({
    where: {
      isActive: true,
      section: ROSTER_SECTION,
      contentKey: ROSTER_MISMATCH_CONTENT_KEY,
    },
    order: [['updatedAt', 'DESC']],
  });

  const value = row?.valueZh || DEFAULT_MISMATCH_PROMPT_ZH;
  getMismatchPromptZh._cache = { at: now, value };
  return value;
}

function parseRosterMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) {
    const err = new Error('Excel 內容無法解析或沒有資料列。');
    err.code = 'ROSTER_EMPTY';
    throw err;
  }

  const headerRow = matrix[0] || [];
  const header = headerRow.map((h) => String(h ?? '').trim());

  const idxStudentId = header.findIndex((h) => h === '學號');
  const idxIdNumber = header.findIndex((h) => h === '身分證字號');
  const idxNameZh = header.findIndex((h) => h === '姓名');

  if (idxStudentId < 0 || idxIdNumber < 0) {
    const err = new Error('Excel 表頭必須包含「學號」與「身分證字號」兩欄。');
    err.code = 'ROSTER_MISSING_HEADERS';
    throw err;
  }

  const totalDataRows = Math.max(0, matrix.length - 1);
  const conflicts = [];
  const invalidRows = [];
  const dedupe = new Map(); // studentId -> { studentId, idNumber, nameZh }

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    if (isEmptyRow(row)) continue;

    const rawStudentId = row[idxStudentId];
    const rawIdNumber = row[idxIdNumber];
    const rawNameZh = idxNameZh >= 0 ? row[idxNameZh] : null;

    const studentId = normalizeStudentId(rawStudentId);
    const idNumber = normalizeIdNumber(rawIdNumber);
    const nameZh = rawNameZh == null ? null : String(rawNameZh).trim() || null;

    const excelRowNumber = i + 1; // 1-indexed in Excel display

    if (!studentId) {
      invalidRows.push({ row: excelRowNumber, field: '學號', message: '學號為空或格式無效', value: rawStudentId ?? '-' });
      continue;
    }
    if (!idNumber) {
      invalidRows.push({ row: excelRowNumber, field: '身分證字號', message: '身分證字號為空或格式無效', value: rawIdNumber ?? '-' });
      continue;
    }

    const prev = dedupe.get(studentId);
    if (!prev) {
      dedupe.set(studentId, { studentId, idNumber, nameZh });
      continue;
    }

    // 同一學號出現多筆且身分證不同：視為衝突，跳過該學號
    if (prev.idNumber !== idNumber) {
      conflicts.push({
        row: excelRowNumber,
        studentId,
        expectedIdNumber: prev.idNumber,
        actualIdNumber: idNumber,
      });
      // 移除之前那筆，確保不會寫入不一致資料
      dedupe.delete(studentId);
    }
  }

  const entries = [...dedupe.values()];
  return {
    totalDataRows,
    insertedCount: entries.length,
    conflictCount: conflicts.length,
    invalidRows,
    conflicts,
    entries,
  };
}

async function parseRosterExcelToEntries(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    const err = new Error('找不到 Excel 第一張工作表。');
    err.code = 'ROSTER_NO_SHEET';
    throw err;
  }

  // header: 1 => 以矩陣方式讀取（能處理重複欄名）
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return parseRosterMatrix(matrix);
}

async function replaceLatestRosterFromUpload({ fileNameOriginal, storedFileUrl, buffer }) {
  const parsed = await parseRosterExcelToEntries(buffer);

  const t = await sequelize.transaction();
  try {
    // 覆蓋：只保留「最新一份」的 mapping 與上傳 metadata
    await EnglishTestStudentIdCardRosterEntry.destroy({ where: {}, transaction: t });
    await EnglishTestStudentIdCardRosterUpload.destroy({ where: {}, transaction: t });

    const upload = await EnglishTestStudentIdCardRosterUpload.create({
      fileNameOriginal,
      storedFileUrl: storedFileUrl || null,
      rowCount: parsed.totalDataRows,
      validCount: parsed.insertedCount,
      conflictCount: parsed.conflictCount,
    }, { transaction: t });

    if (parsed.entries.length) {
      await EnglishTestStudentIdCardRosterEntry.bulkCreate(parsed.entries, { transaction: t });
    }

    await t.commit();

    return {
      upload,
      success: true,
      insertedCount: parsed.insertedCount,
      conflictCount: parsed.conflictCount,
      invalidRows: parsed.invalidRows,
      conflicts: parsed.conflicts,
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function getLatestRosterPreview({ offset = 0, limit = 30 } = {}) {
  const upload = await EnglishTestStudentIdCardRosterUpload.findOne({
    order: [['createdAt', 'DESC']],
  });

  const totalEntries = await EnglishTestStudentIdCardRosterEntry.count();
  const entries = await EnglishTestStudentIdCardRosterEntry.findAll({
    order: [['studentId', 'ASC']],
    offset: Number(offset) || 0,
    limit: Number(limit) || 30,
  });

  return {
    upload,
    totalEntries,
    entries: entries.map((r) => ({
      studentId: r.studentId,
      idNumber: r.idNumber,
      nameZh: r.nameZh,
    })),
  };
}

async function checkStudentIdIdNumberMatch({ studentId, idNumber }) {
  const normalizedStudentId = normalizeStudentId(studentId);
  const normalizedIdNumber = normalizeIdNumber(idNumber);
  const promptZh = await getMismatchPromptZh();

  // 尚未上傳過任何學名單時，不進行比對，以避免整個報名功能被阻擋
  const latestUpload = await EnglishTestStudentIdCardRosterUpload.findOne({
    order: [['createdAt', 'DESC']],
    attributes: ['id'],
  });
  if (!latestUpload) {
    return { matched: true };
  }

  if (!normalizedStudentId || !normalizedIdNumber) {
    return {
      matched: false,
      code: 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH',
      message: promptZh,
    };
  }

  const entry = await EnglishTestStudentIdCardRosterEntry.findByPk(normalizedStudentId);
  if (!entry) {
    return {
      matched: false,
      code: 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH',
      message: promptZh,
    };
  }

  const ok = entry.idNumber === normalizedIdNumber;
  if (!ok) {
    return {
      matched: false,
      code: 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH',
      message: promptZh,
    };
  }

  return { matched: true };
}

function buildRosterSampleWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('學名單範例');

  worksheet.addRow([
    '系所',
    '學院',
    '班別',
    '年級',
    '學號',
    '身分證字號',
    '姓名',
    '英文姓名',
    '生日',
    '郵遞區號',
    '地址',
    '電話',
    'email',
    'email',
    '學籍狀態',
    '入學管道',
    '身分',
    '國籍',
  ]);

  worksheet.getRow(1).font = { bold: true };

  worksheet.addRow([
    '（範例）語言中心',
    '（範例）學院 A',
    '（範例）班別 1',
    '113',
    'S1234567',
    'A123456789',
    '王小明',
    'Xiao Ming Wang',
    '2000-01-01',
    '',
    '',
    '',
    'student@example.com',
    'student@example.com',
    '在學',
    '一般',
    '一般生',
    '台灣',
  ]);

  return workbook;
}

module.exports = {
  normalizeStudentId,
  normalizeIdNumber,
  parseRosterExcelToEntries,
  replaceLatestRosterFromUpload,
  getLatestRosterPreview,
  checkStudentIdIdNumberMatch,
  buildRosterSampleWorkbook,
  ROSTER_MISMATCH_CONTENT_KEY,
  ROSTER_SECTION,
};

