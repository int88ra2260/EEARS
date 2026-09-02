'use strict';

const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

const sequelize = require('../db');
const { SiteContentEntry, EnglishTestStudentIdCardRosterUpload, EnglishTestStudentIdCardRosterEntry } = require('../models');

const ROSTER_SECTION = 'english_test_registration';
const ROSTER_MISMATCH_CONTENT_KEY = 'englishTestRegistration.idCardMismatchMessage';
const ROSTER_MATCH_FIELDS_CONTENT_KEY = 'englishTestRegistration.rosterMatchFields';

const DEFAULT_MISMATCH_PROMPT_ZH = [
  '您輸入的資料與在學名單不符，請確認後重新填寫。',
  '如有疑問，請聯繫全英語卓越教學中心。',
].join('\n');

const DEFAULT_MATCH_FIELDS = Object.freeze({
  studentId: true,
  name: false,
  idNumber: true,
});

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

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function normalizeMatchFields(raw) {
  const fields = {
    studentId: !!raw?.studentId,
    name: !!raw?.name,
    idNumber: !!raw?.idNumber,
  };
  if (!fields.studentId && !fields.name && !fields.idNumber) {
    return { ...DEFAULT_MATCH_FIELDS };
  }
  return fields;
}

function isEmptyRow(row) {
  if (!Array.isArray(row)) return true;
  return row.every((c) => c == null || String(c).trim() === '');
}

async function getMismatchPromptZh() {
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

async function getRosterMatchFields() {
  const now = Date.now();
  if (getRosterMatchFields._cache && now - getRosterMatchFields._cache.at < 30_000) {
    return getRosterMatchFields._cache.value;
  }

  const row = await SiteContentEntry.findOne({
    where: {
      isActive: true,
      section: ROSTER_SECTION,
      contentKey: ROSTER_MATCH_FIELDS_CONTENT_KEY,
    },
    order: [['updatedAt', 'DESC']],
  });

  let value = { ...DEFAULT_MATCH_FIELDS };
  if (row?.valueZh) {
    try {
      value = normalizeMatchFields(JSON.parse(row.valueZh));
    } catch {
      value = { ...DEFAULT_MATCH_FIELDS };
    }
  }

  getRosterMatchFields._cache = { at: now, value };
  return value;
}

async function setRosterMatchFields(rawFields) {
  const normalized = normalizeMatchFields(rawFields);
  const payload = {
    entryType: 'text',
    section: ROSTER_SECTION,
    contentKey: ROSTER_MATCH_FIELDS_CONTENT_KEY,
    label: '英檢：在學名單比對欄位',
    valueZh: JSON.stringify(normalized),
    isActive: true,
  };

  const existing = await SiteContentEntry.findOne({
    where: { contentKey: ROSTER_MATCH_FIELDS_CONTENT_KEY },
  });

  if (existing) {
    await existing.update(payload);
  } else {
    await SiteContentEntry.create(payload);
  }

  getRosterMatchFields._cache = { at: Date.now(), value: normalized };
  return normalized;
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

  if (idxStudentId < 0 || idxIdNumber < 0 || idxNameZh < 0) {
    const err = new Error('Excel 表頭必須包含「學號」「身分證字號」「姓名」三欄。');
    err.code = 'ROSTER_MISSING_HEADERS';
    throw err;
  }

  const totalDataRows = Math.max(0, matrix.length - 1);
  const conflicts = [];
  const invalidRows = [];
  const dedupe = new Map();

  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    if (isEmptyRow(row)) continue;

    const rawStudentId = row[idxStudentId];
    const rawIdNumber = row[idxIdNumber];
    const rawNameZh = row[idxNameZh];

    const studentId = normalizeStudentId(rawStudentId);
    const idNumber = normalizeIdNumber(rawIdNumber);
    const nameZh = normalizeName(rawNameZh) || null;

    const excelRowNumber = i + 1;

    if (!studentId) {
      invalidRows.push({ row: excelRowNumber, field: '學號', message: '學號為空或格式無效', value: rawStudentId ?? '-' });
      continue;
    }
    if (!idNumber) {
      invalidRows.push({ row: excelRowNumber, field: '身分證字號', message: '身分證字號為空或格式無效', value: rawIdNumber ?? '-' });
      continue;
    }
    if (!nameZh) {
      invalidRows.push({ row: excelRowNumber, field: '姓名', message: '姓名為空或格式無效', value: rawNameZh ?? '-' });
      continue;
    }

    const prev = dedupe.get(studentId);
    if (!prev) {
      dedupe.set(studentId, { studentId, idNumber, nameZh });
      continue;
    }

    if (prev.idNumber !== idNumber || prev.nameZh !== nameZh) {
      conflicts.push({
        row: excelRowNumber,
        studentId,
        expectedIdNumber: prev.idNumber,
        actualIdNumber: idNumber,
        expectedNameZh: prev.nameZh,
        actualNameZh: nameZh,
      });
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

  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return parseRosterMatrix(matrix);
}

async function replaceLatestRosterFromUpload({ fileNameOriginal, storedFileUrl, buffer }) {
  const parsed = await parseRosterExcelToEntries(buffer);

  const t = await sequelize.transaction();
  try {
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

async function clearRoster() {
  const t = await sequelize.transaction();
  try {
    const deletedEntries = await EnglishTestStudentIdCardRosterEntry.destroy({ where: {}, transaction: t });
    const deletedUploads = await EnglishTestStudentIdCardRosterUpload.destroy({ where: {}, transaction: t });
    await t.commit();
    return {
      success: true,
      deletedEntries,
      deletedUploads,
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

  const matchFields = await getRosterMatchFields();

  return {
    upload,
    totalEntries,
    matchFields,
    entries: entries.map((r) => ({
      studentId: r.studentId,
      idNumber: r.idNumber,
      nameZh: r.nameZh,
    })),
  };
}

function entryMatchesFields(entry, normalized, matchFields) {
  if (matchFields.studentId && entry.studentId !== normalized.studentId) return false;
  if (matchFields.idNumber && entry.idNumber !== normalized.idNumber) return false;
  if (matchFields.name && normalizeName(entry.nameZh) !== normalized.name) return false;
  return true;
}

async function loadRosterCandidates(normalized, matchFields) {
  if (matchFields.studentId && normalized.studentId) {
    const entry = await EnglishTestStudentIdCardRosterEntry.findByPk(normalized.studentId);
    return entry ? [entry] : [];
  }

  const where = {};
  if (matchFields.idNumber && normalized.idNumber) {
    where.idNumber = normalized.idNumber;
  }

  if (Object.keys(where).length > 0) {
    return EnglishTestStudentIdCardRosterEntry.findAll({ where });
  }

  return EnglishTestStudentIdCardRosterEntry.findAll();
}

/**
 * 比對學生填寫資料與 admin 上傳的在學名單。
 * 勾選多個欄位時，須在同一筆 Excel 列全部符合。
 * 尚未上傳名單時不阻擋（matched: true）。
 */
async function checkRosterMatch({ studentId, name, idNumber }) {
  const matchFields = await getRosterMatchFields();
  const promptZh = await getMismatchPromptZh();

  const latestUpload = await EnglishTestStudentIdCardRosterUpload.findOne({
    order: [['createdAt', 'DESC']],
    attributes: ['id'],
  });
  if (!latestUpload) {
    return { matched: true, matchFields };
  }

  const normalized = {
    studentId: normalizeStudentId(studentId),
    idNumber: normalizeIdNumber(idNumber),
    name: normalizeName(name),
  };

  const fail = {
    matched: false,
    code: 'ENGLISH_TEST_STUDENT_IDCARD_MISMATCH',
    message: promptZh,
    matchFields,
  };

  if (matchFields.studentId && !normalized.studentId) return fail;
  if (matchFields.idNumber && !normalized.idNumber) return fail;
  if (matchFields.name && !normalized.name) return fail;

  const candidates = await loadRosterCandidates(normalized, matchFields);
  const matched = candidates.some((entry) => entryMatchesFields(entry, normalized, matchFields));

  if (!matched) return fail;
  return { matched: true, matchFields };
}

/** @deprecated 使用 checkRosterMatch */
async function checkStudentIdIdNumberMatch({ studentId, idNumber, name }) {
  return checkRosterMatch({ studentId, name, idNumber });
}

function buildRosterSampleWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('在學名單範例');

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
  normalizeName,
  normalizeMatchFields,
  parseRosterMatrix,
  parseRosterExcelToEntries,
  replaceLatestRosterFromUpload,
  clearRoster,
  getLatestRosterPreview,
  getRosterMatchFields,
  setRosterMatchFields,
  checkRosterMatch,
  checkStudentIdIdNumberMatch,
  buildRosterSampleWorkbook,
  ROSTER_MISMATCH_CONTENT_KEY,
  ROSTER_MATCH_FIELDS_CONTENT_KEY,
  ROSTER_SECTION,
  DEFAULT_MATCH_FIELDS,
};
