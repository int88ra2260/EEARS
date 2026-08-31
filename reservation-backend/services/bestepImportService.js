// services/bestepImportService.js
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { 
  EnglishTestRegistration,
  BestepAttendance,
  BestepExamScore,
  sequelize
} = require('../models');
const { Op } = require('sequelize');
const { findRegistrationForSemester } = require('./englishTestRegistrationService');

// CEFR 等級列表
const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// 欄位名稱對應表
const FIELD_MAPPINGS = {
  attendance: {
    studentId: ['學號', 'Student ID', 'studentId', '學號代碼', 'student_id'],
    name: ['姓名', 'Name', 'name', '學生姓名', 'student_name'],
    examItems: ['報考項目', '應考項目', '考試項目', 'examItems', 'exam_items', 'examItem'],
    lAbsent: ['L出缺席', 'L 出缺席', '聽力出缺席', 'listeningAttendance', 'listening_absence', 'L出席'],
    rAbsent: ['R出缺席', 'R 出缺席', '閱讀出缺席', 'readingAttendance', 'reading_absence', 'R出席'],
    wAbsent: ['W出缺席', 'W 出缺席', '寫作出缺席', 'writingAttendance', 'writing_absence', 'W出席'],
    sAbsent: ['S出缺席', 'S 出缺席', '口說出缺席', 'speakingAttendance', 'speaking_absence', 'S出席'],
    attended: ['出席狀態', 'Attendance', 'attended', '是否出席', '出席/缺席', '出席'],
    absentReason: ['缺席原因', 'Absent Reason', 'absentReason', '原因', '備註', '缺席原因']
  },
  scores: {
    studentId: ['學號', 'Student ID', 'studentId', '學號代碼', 'student_id'],
    name: ['姓名', 'Name', 'name', '學生姓名', '考生姓名', 'student_name'],
    listeningScore: ['聽力分數', 'Listening', 'listeningScore', '聽力', 'L', '聽力成績', '聽力總分', 'listening_score'],
    readingScore: ['閱讀分數', 'Reading', 'readingScore', '閱讀', 'R', '閱讀成績', '閱讀總分', 'reading_score'],
    speakingScore: ['口說分數', 'Speaking', 'speakingScore', '口說', 'S', '口說成績', '口說總分', 'speaking_score'],
    writingScore: ['寫作分數', 'Writing', 'writingScore', '寫作', 'W', '寫作成績', '寫作總分', 'writing_score'],
    listeningLevel: ['聽力等級', 'Listening Level', 'listeningLevel', '聽力CEFR', '聽力級別', '聽力CEFR級數', 'listening_level'],
    readingLevel: ['閱讀等級', 'Reading Level', 'readingLevel', '閱讀CEFR', '閱讀級別', '閱讀CEFR級數', 'reading_level'],
    speakingLevel: ['口說等級', 'Speaking Level', 'speakingLevel', '口說CEFR', '口說級別', '口說CEFR級數', 'speaking_level'],
    writingLevel: ['寫作等級', 'Writing Level', 'writingLevel', '寫作CEFR', '寫作級別', '寫作CEFR級數', 'writing_level'],
    totalScore: ['總分', 'Total', 'totalScore', '總成績', '合計', 'total_score']
  }
};

const SCORE_RANGES = {
  listening: { min: 0, max: 140, label: '聽力' },
  reading: { min: 0, max: 140, label: '閱讀' },
  speaking: { min: 0, max: 360, label: '口說' },
  writing: { min: 0, max: 360, label: '寫作' }
};

/**
 * 自動識別欄位名稱
 * @param {object} row - Excel 行資料（物件）
 * @param {string} fieldType - 'attendance' 或 'scores'
 * @param {string} targetField - 目標欄位名稱
 * @returns {any} 欄位值
 */
function getFieldValue(row, fieldType, targetField) {
  const mappings = FIELD_MAPPINGS[fieldType][targetField] || [];
  for (const mapping of mappings) {
    if (row[mapping] !== undefined && row[mapping] !== null && row[mapping] !== '') {
      return row[mapping];
    }
  }
  // Excel 表頭可能含前後空白，再以 trim 比對一次
  const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
    String(key || '').trim(),
    value
  ]);
  for (const mapping of mappings) {
    const hit = normalizedEntries.find(([key]) => key === mapping);
    if (hit && hit[1] !== undefined && hit[1] !== null && hit[1] !== '') {
      return hit[1];
    }
  }
  return null;
}

function parseNullableScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const score = parseFloat(String(value).replace(/,/g, '').trim());
  return Number.isNaN(score) ? NaN : score;
}

function normalizeCefrLevel(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().toUpperCase();
  if (!text) return null;
  if (text.includes('未達A1')) return 'A1';
  const match = text.match(/^(A1|A2|B1|B2|C1|C2)\+?$/);
  return match ? match[1] : text;
}

/**
 * 解析出席狀態值
 * @param {any} value - 原始值
 * @returns {boolean} 是否出席
 */
function parseAttendanceStatus(value) {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toLowerCase();
  const attendedValues = ['出席', '是', 'y', 'yes', 'true', '1', '✓', 'v'];
  return attendedValues.includes(str);
}

function normalizeExamItemToken(token) {
  const text = String(token || '').trim().toUpperCase();
  if (!text) return null;
  if (text === 'LR') return 'LR';
  if (text === 'SW') return 'SW';
  if (text === 'L') return 'L';
  if (text === 'R') return 'R';
  if (text === 'S') return 'S';
  if (text === 'W') return 'W';
  if (text === 'LRSW') return 'LRSW';
  return null;
}

function parseExamItems(rawValue) {
  const source = String(rawValue || '').trim();
  if (!source) return [];
  const chunks = source.split(/[,，/、\s]+/).map((item) => normalizeExamItemToken(item)).filter(Boolean);
  return [...new Set(chunks)];
}

function isAbsentMark(value) {
  const text = String(value == null ? '' : value).trim();
  return text.includes('缺席');
}

function expandToAtomicExamTypes(tokens) {
  const atomic = new Set();
  for (const token of tokens) {
    if (token === 'LR') {
      atomic.add('L');
      atomic.add('R');
      continue;
    }
    if (token === 'SW') {
      atomic.add('S');
      atomic.add('W');
      continue;
    }
    if (token === 'LRSW') {
      atomic.add('L');
      atomic.add('R');
      atomic.add('S');
      atomic.add('W');
      continue;
    }
    atomic.add(token);
  }
  return [...atomic];
}

function buildLegacyAbsentReason(baseReason, attended) {
  const reason = String(baseReason || '').trim();
  if (attended) return null;
  return reason || '缺席';
}

function newBestepImportBatchId(kind) {
  const prefix = kind === 'scores' ? 'bestep-scores' : 'bestep-attendance';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildBestepAttendanceRecords({
  row,
  requestedExamType,
  semester,
  examDate,
  studentId,
  sourceFile,
  importBatchId
}) {
  const rows = [];
  const examItemsRaw = getFieldValue(row, 'attendance', 'examItems');
  const parsedExamItems = parseExamItems(examItemsRaw);
  const examItems = parsedExamItems.length > 0 ? parsedExamItems : (requestedExamType ? [requestedExamType] : []);
  const atomicTypes = expandToAtomicExamTypes(examItems);

  const lAbsentRaw = getFieldValue(row, 'attendance', 'lAbsent');
  const rAbsentRaw = getFieldValue(row, 'attendance', 'rAbsent');
  const wAbsentRaw = getFieldValue(row, 'attendance', 'wAbsent');
  const sAbsentRaw = getFieldValue(row, 'attendance', 'sAbsent');
  const hasLAbsentColumn = lAbsentRaw !== null && lAbsentRaw !== undefined && String(lAbsentRaw).trim() !== '';
  const hasRAbsentColumn = rAbsentRaw !== null && rAbsentRaw !== undefined && String(rAbsentRaw).trim() !== '';
  const hasWAbsentColumn = wAbsentRaw !== null && wAbsentRaw !== undefined && String(wAbsentRaw).trim() !== '';
  const hasSAbsentColumn = sAbsentRaw !== null && sAbsentRaw !== undefined && String(sAbsentRaw).trim() !== '';
  const lAbsent = isAbsentMark(lAbsentRaw);
  const rAbsent = isAbsentMark(rAbsentRaw);
  const wAbsent = isAbsentMark(wAbsentRaw);
  const sAbsent = isAbsentMark(sAbsentRaw);
  const baseReason = getFieldValue(row, 'attendance', 'absentReason');
  const attendedValue = getFieldValue(row, 'attendance', 'attended');
  const hasLegacyAttendedColumn = attendedValue !== null && attendedValue !== undefined;
  const legacyAttended = parseAttendanceStatus(attendedValue);

  for (const atomicType of atomicTypes) {
    let attended = true;
    let absentReason = null;

    if (atomicType === 'L') {
      if (hasLAbsentColumn) {
        attended = !lAbsent;
        absentReason = attended ? null : '聽力缺席';
      } else if (hasLegacyAttendedColumn) {
        attended = legacyAttended;
        absentReason = buildLegacyAbsentReason(baseReason, attended);
      }
    } else if (atomicType === 'R') {
      if (hasRAbsentColumn) {
        attended = !rAbsent;
        absentReason = attended ? null : '閱讀缺席';
      } else if (hasLegacyAttendedColumn) {
        attended = legacyAttended;
        absentReason = buildLegacyAbsentReason(baseReason, attended);
      }
    } else if (atomicType === 'S') {
      if (hasSAbsentColumn) {
        attended = !sAbsent;
        absentReason = attended ? null : '口說缺席';
      } else if (hasLegacyAttendedColumn) {
        attended = legacyAttended;
        absentReason = buildLegacyAbsentReason(baseReason, attended);
      }
    } else if (atomicType === 'W') {
      if (hasWAbsentColumn) {
        attended = !wAbsent;
        absentReason = attended ? null : '寫作缺席';
      } else if (hasLegacyAttendedColumn) {
        attended = legacyAttended;
        absentReason = buildLegacyAbsentReason(baseReason, attended);
      }
    }

    rows.push({
      studentId,
      semester,
      examType: atomicType,
      examDate,
      attended,
      absentReason,
      importedAt: new Date(),
      sourceFile,
      importBatchId
    });
  }

  const hasL = atomicTypes.includes('L');
  const hasR = atomicTypes.includes('R');
  const hasS = atomicTypes.includes('S');
  const hasW = atomicTypes.includes('W');

  if (hasL && hasR) {
    const l = rows.find((x) => x.examType === 'L');
    const r = rows.find((x) => x.examType === 'R');
    rows.push({
      studentId,
      semester,
      examType: 'LR',
      examDate,
      attended: Boolean(l && l.attended) && Boolean(r && r.attended),
      absentReason: (!l?.attended || !r?.attended) ? '聽讀缺席' : null,
      importedAt: new Date(),
      sourceFile,
      importBatchId
    });
  }

  if (hasS && hasW) {
    const s = rows.find((x) => x.examType === 'S');
    const w = rows.find((x) => x.examType === 'W');
    const reasons = [];
    if (s && !s.attended) reasons.push('口說缺席');
    if (w && !w.attended) reasons.push('寫作缺席');
    rows.push({
      studentId,
      semester,
      examType: 'SW',
      examDate,
      attended: Boolean(s && s.attended) && Boolean(w && w.attended),
      absentReason: reasons.length > 0 ? reasons.join('、') : null,
      importedAt: new Date(),
      sourceFile,
      importBatchId
    });
  }

  return rows;
}

/**
 * 計算整體等級（取最低項）
 * @param {string[]} levels - 各項等級陣列
 * @returns {string|null}
 */
function calculateOverallLevel(levels) {
  const validLevels = levels.filter(l => l && CEFR_LEVELS.includes(l));
  if (validLevels.length === 0) return null;
  const indices = validLevels.map(l => CEFR_LEVELS.indexOf(l));
  const minIndex = Math.min(...indices);
  return CEFR_LEVELS[minIndex];
}

/**
 * 判斷是否達標（各項都達 B2 以上）
 * @param {string[]} levels - 各項等級陣列
 * @returns {boolean}
 */
function isPassed(levels) {
  const validLevels = levels.filter(l => l && CEFR_LEVELS.includes(l));
  if (validLevels.length !== 4) return false; // 必須四項都有等級
  const minLevelIndex = CEFR_LEVELS.indexOf('B2');
  return validLevels.every(level => CEFR_LEVELS.indexOf(level) >= minLevelIndex);
}

/**
 * 匯入出席資料
 * @param {string} filePath - Excel 檔案路徑
 * @param {string} semester - 學期
 * @param {string|null} examType - 可傳 LR/SW/L/R/S/W；官方模板可省略
 * @param {string} examDate - 考試日期
 * @returns {Promise<object>}
 */
async function importAttendanceData(filePath, semester, examType, examDate) {
  const transaction = await sequelize.transaction();
  const errors = [];
  let imported = 0;
  let skipped = 0;
  const importBatchId = newBestepImportBatchId('attendance');

  try {
    // 讀取 Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    const sourceFile = path.basename(filePath);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel 行號從 2 開始

      try {
        // 取得欄位值
        const studentId = getFieldValue(row, 'attendance', 'studentId');
        const name = getFieldValue(row, 'attendance', 'name');

        // 驗證學號
        if (!studentId || String(studentId).trim() === '') {
          errors.push({
            row: rowNum,
            studentId: studentId || '',
            name: name || '',
            error: 'MISSING_STUDENT_ID',
            message: '學號為空'
          });
          skipped++;
          continue;
        }

        const cleanStudentId = String(studentId).trim().toUpperCase();

        // 驗證學號是否存在於本學期報名記錄中（且 status='success'）
        const { registration } = await findRegistrationForSemester(cleanStudentId, semester, { transaction });

        if (!registration || registration.status !== 'success') {
          errors.push({
            row: rowNum,
            studentId: cleanStudentId,
            name: name || '',
            error: 'STUDENT_NOT_FOUND',
            message: '找不到該學號的報名記錄（或報名狀態不是「報名成功」）'
          });
          skipped++;
          continue;
        }

        const examTypeInput = String(examType || '').trim().toUpperCase();
        const attendanceRecords = buildBestepAttendanceRecords({
          row,
          requestedExamType: examTypeInput || null,
          semester,
          examDate,
          studentId: cleanStudentId,
          sourceFile,
          importBatchId
        });

        if (attendanceRecords.length === 0) {
          errors.push({
            row: rowNum,
            studentId: cleanStudentId,
            name: name || '',
            error: 'MISSING_EXAM_ITEMS',
            message: '缺少應考項目，無法判斷要寫入哪個考試類型'
          });
          skipped++;
          continue;
        }

        for (const record of attendanceRecords) {
          await BestepAttendance.upsert(record, { transaction });
          imported++;
        }

      } catch (error) {
        errors.push({
          row: rowNum,
          studentId: getFieldValue(row, 'attendance', 'studentId') || '',
          name: getFieldValue(row, 'attendance', 'name') || '',
          error: 'PROCESSING_ERROR',
          message: error.message
        });
        skipped++;
      }
    }

    await transaction.commit();

    return {
      imported,
      skipped,
      errors,
      importBatchId,
      sourceFile
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * 匯入成績資料
 * @param {string} filePath - Excel 檔案路徑
 * @param {string} semester - 學期
 * @returns {Promise<object>}
 */
async function importScoreData(filePath, semester) {
  const transaction = await sequelize.transaction();
  const errors = [];
  let imported = 0;
  let skipped = 0;
  const importBatchId = newBestepImportBatchId('scores');

  try {
    // 讀取 Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    const sourceFile = path.basename(filePath);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel 行號從 2 開始

      try {
        // 取得欄位值
        const studentId = getFieldValue(row, 'scores', 'studentId');
        const name = getFieldValue(row, 'scores', 'name');
        const listeningScore = getFieldValue(row, 'scores', 'listeningScore');
        const readingScore = getFieldValue(row, 'scores', 'readingScore');
        const speakingScore = getFieldValue(row, 'scores', 'speakingScore');
        const writingScore = getFieldValue(row, 'scores', 'writingScore');
        const listeningLevel = getFieldValue(row, 'scores', 'listeningLevel');
        const readingLevel = getFieldValue(row, 'scores', 'readingLevel');
        const speakingLevel = getFieldValue(row, 'scores', 'speakingLevel');
        const writingLevel = getFieldValue(row, 'scores', 'writingLevel');
        const totalScore = getFieldValue(row, 'scores', 'totalScore');

        // 驗證學號
        if (!studentId || String(studentId).trim() === '') {
          errors.push({
            row: rowNum,
            studentId: studentId || '',
            name: name || '',
            error: 'MISSING_STUDENT_ID',
            message: '學號為空'
          });
          skipped++;
          continue;
        }

        const cleanStudentId = String(studentId).trim().toUpperCase();

        // 驗證學號是否存在於本學期報名記錄中（且 status='success'）
        const { registration } = await findRegistrationForSemester(cleanStudentId, semester, { transaction });

        if (!registration || registration.status !== 'success') {
          errors.push({
            row: rowNum,
            studentId: cleanStudentId,
            name: name || '',
            error: 'STUDENT_NOT_FOUND',
            message: '找不到該學號的報名記錄（或報名狀態不是「報名成功」）'
          });
          skipped++;
          continue;
        }

        // 驗證分數（轉換為數字）
        const scores = {
          listening: parseNullableScore(listeningScore),
          reading: parseNullableScore(readingScore),
          speaking: parseNullableScore(speakingScore),
          writing: parseNullableScore(writingScore)
        };

        let validationFailed = false;
        for (const [key, value] of Object.entries(scores)) {
          const range = SCORE_RANGES[key];
          if (value !== null && (Number.isNaN(value) || value < range.min || value > range.max)) {
            errors.push({
              row: rowNum,
              studentId: cleanStudentId,
              name: name || '',
              error: 'INVALID_SCORE',
              message: `${range.label}分數格式錯誤或超出範圍（${range.min}-${range.max}）`
            });
            skipped++;
            validationFailed = true;
            break;
          }
        }
        if (validationFailed) continue;

        const scoreValuesForPresence = Object.values(scores).filter(s => s !== null);
        if (scoreValuesForPresence.length === 0) {
          errors.push({
            row: rowNum,
            studentId: cleanStudentId,
            name: name || '',
            error: 'MISSING_SCORES',
            message: '找不到可匯入的分數欄位，請確認 Excel 表頭是否符合格式'
          });
          skipped++;
          continue;
        }

        // 驗證等級
        const levels = {
          listening: normalizeCefrLevel(listeningLevel),
          reading: normalizeCefrLevel(readingLevel),
          speaking: normalizeCefrLevel(speakingLevel),
          writing: normalizeCefrLevel(writingLevel)
        };

        // 驗證等級格式
        for (const [key, value] of Object.entries(levels)) {
          if (value && !CEFR_LEVELS.includes(value)) {
            errors.push({
              row: rowNum,
              studentId: cleanStudentId,
              name: name || '',
              error: 'INVALID_LEVEL',
              message: `${key}等級格式錯誤（應為 A1, A2, B1, B2, C1, C2 之一）`
            });
            skipped++;
            validationFailed = true;
            break;
          }
        }
        if (validationFailed) continue;

        // 計算總分（若未提供）
        let calculatedTotalScore = parseNullableScore(totalScore);
        if (calculatedTotalScore === null || isNaN(calculatedTotalScore)) {
          const scoreValues = Object.values(scores).filter(s => s !== null);
          if (scoreValues.length === 4) {
            calculatedTotalScore = scoreValues.reduce((a, b) => a + b, 0);
          }
        }

        // 驗證總分（若提供）
        if (calculatedTotalScore !== null) {
          const sumOfScores = Object.values(scores).filter(s => s !== null).reduce((a, b) => a + b, 0);
          if (Math.abs(calculatedTotalScore - sumOfScores) > 1) {
            errors.push({
              row: rowNum,
              studentId: cleanStudentId,
              name: name || '',
              error: 'TOTAL_SCORE_MISMATCH',
              message: `總分與各科分數總和不符（總分：${calculatedTotalScore}，各科總和：${sumOfScores}）`
            });
            skipped++;
            continue;
          }
        }

        // 計算整體等級和達標狀態
        const levelValues = [levels.listening, levels.reading, levels.speaking, levels.writing];
        const overallLevel = calculateOverallLevel(levelValues);
        const passed = isPassed(levelValues);

        // 確保總分已計算
        if (calculatedTotalScore === null || isNaN(calculatedTotalScore)) {
          const scoreValues = Object.values(scores).filter(s => s !== null);
          if (scoreValues.length === 4) {
            calculatedTotalScore = scoreValues.reduce((a, b) => a + b, 0);
          }
        }

        // 更新或建立成績記錄
        await BestepExamScore.upsert({
          studentId: cleanStudentId,
          semester,
          examDate: null, // 可能 LR 和 SW 不同日期，暫時設為 null
          listeningScore: scores.listening,
          readingScore: scores.reading,
          speakingScore: scores.speaking,
          writingScore: scores.writing,
          listeningLevel: levels.listening,
          readingLevel: levels.reading,
          speakingLevel: levels.speaking,
          writingLevel: levels.writing,
          totalScore: calculatedTotalScore,
          overallLevel,
          passed,
          importedAt: new Date(),
          sourceFile,
          importBatchId
        }, {
          transaction
        });

        imported++;

      } catch (error) {
        errors.push({
          row: rowNum,
          studentId: getFieldValue(row, 'scores', 'studentId') || '',
          name: getFieldValue(row, 'scores', 'name') || '',
          error: 'PROCESSING_ERROR',
          message: error.message
        });
        skipped++;
      }
    }

    await transaction.commit();

    return {
      imported,
      skipped,
      errors,
      importBatchId,
      sourceFile
    };

  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * 生成錯誤報表 Excel
 * @param {array} errors - 錯誤列表
 * @param {string} outputPath - 輸出檔案路徑
 */
async function generateErrorReport(errors, outputPath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('錯誤報表');

  // 設定欄位
  worksheet.columns = [
    { header: '行號', key: 'row', width: 10 },
    { header: '學號', key: 'studentId', width: 15 },
    { header: '姓名', key: 'name', width: 15 },
    { header: '錯誤類型', key: 'error', width: 20 },
    { header: '錯誤訊息', key: 'message', width: 50 }
  ];

  // 加入錯誤資料
  errors.forEach(error => {
    worksheet.addRow({
      row: error.row,
      studentId: error.studentId || '',
      name: error.name || '',
      error: error.error || 'UNKNOWN_ERROR',
      message: error.message || '未知錯誤'
    });
  });

  // 儲存檔案
  await workbook.xlsx.writeFile(outputPath);
}

module.exports = {
  importAttendanceData,
  importScoreData,
  generateErrorReport,
  buildBestepAttendanceRecords,
  parseExamItems,
  getFieldValue,
  normalizeCefrLevel,
  parseNullableScore,
  FIELD_MAPPINGS
};
