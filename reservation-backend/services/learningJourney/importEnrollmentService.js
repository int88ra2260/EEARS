'use strict';

const XLSX = require('xlsx');
const { sequelize, Student, EtEnrollmentSnapshot } = require('../../models');

/** DB 欄位長度（對齊正式環境 describe） */
const LIMITS = {
  studentIdStudents: 20,
  studentIdSnapshot: 50,
  studentName: 100,
  department: 100,
  departmentName: 120,
  college: 100,
  collegeCode: 20,
  className: 50,
  gradeSnapshot: 20,
  status: 20,
  batchId: 50,
};

function normSid(s) {
  return String(s || '').trim().toUpperCase();
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function clip(value, max) {
  const s = value == null ? '' : String(value);
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function clipOrNull(value, max) {
  const s = clip(value, max);
  return s || null;
}

function rowKey(r) {
  return [r.department, r.college, r.className, r.grade, r.studentId, r.studentName].join('|');
}

function clipBatchId(value) {
  return clip(value, LIMITS.batchId);
}

/**
 * students.grade 為 tinyint unsigned；只接受合理年級數字。
 * @param {string} gradeRaw
 * @returns {number|null}
 */
function parseStudentGradeTinyint(gradeRaw) {
  const g = String(gradeRaw || '').trim();
  if (!g) return null;
  const n = parseInt(g, 10);
  if (!Number.isFinite(n) || n < 0 || n > 20) return null;
  return n;
}

/**
 * 名冊 snapshot 有 FK → et_semesters；新學期（如 115-1）必須先建立列。
 * @param {string} semesterId
 * @param {import('sequelize').Transaction} transaction
 */
async function ensureSemesterExists(semesterId, transaction) {
  await sequelize.query(
    `INSERT INTO et_semesters
      (id, code, name, startDate, endDate, snapshotDate, isActive, createdAt, updatedAt)
     VALUES
      (:id, :code, :name, NULL, NULL, NULL, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
      code = COALESCE(et_semesters.code, VALUES(code)),
      name = COALESCE(et_semesters.name, VALUES(name)),
      isActive = 1,
      updatedAt = NOW()`,
    {
      replacements: {
        id: semesterId,
        code: semesterId,
        name: `${semesterId}學期`,
      },
      transaction,
    },
  );
}

/**
 * @param {Buffer|ArrayBuffer} file
 * @param {string} semesterId
 * @param {{ batchId?: string }} options
 * @returns {Promise<object>}
 */
async function importEnrollment(file, semesterId, options = {}) {
  const sem = String(semesterId || '').trim();
  const batchId = clipBatchId(
    String(options.batchId || '').trim() || `v3-enroll:${sem}:${Date.now()}`,
  );
  if (!sem) {
    return { ok: false, error: 'semesterId 必填', warnings: [], quarantine: [], imported: 0 };
  }

  const warnings = [];
  const quarantine = [];
  let matrix;
  try {
    const workbook = XLSX.read(file, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        ok: false,
        error: 'Excel 沒有可用工作表',
        errorCode: 'INVALID_EXCEL',
        warnings: [],
        quarantine: [],
        imported: 0,
      };
    }
    const sheet = workbook.Sheets[sheetName];
    matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  } catch (err) {
    return {
      ok: false,
      error: `無法解析 Excel：${err.message || 'unknown'}`,
      errorCode: 'INVALID_EXCEL',
      warnings: [],
      quarantine: [],
      imported: 0,
    };
  }

  const rawRows = [];
  let startRow = 0;
  if (matrix.length && matrix[0]) {
    const first = String(matrix[0][4] || '').toLowerCase();
    if (first.includes('學號') || first.includes('student')) {
      startRow = 1;
    }
  }

  for (let i = startRow; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row || !row.length) continue;
    const studentIdRaw = normSid(row[4]);
    const gradeRaw = normName(row[3] || '');
    rawRows.push({
      department: normName(row[0] || ''),
      college: normName(row[1] || ''),
      className: normName(row[2] || ''),
      grade: gradeRaw,
      studentId: studentIdRaw,
      studentName: normName(row[5] || ''),
      _line: i + 1,
    });
  }

  // 正規化欄位長度（寫入前裁切，過長則 warning）
  for (const r of rawRows) {
    if (r.className && r.className.length > LIMITS.className) {
      warnings.push(`第 ${r._line} 列：班別超過 ${LIMITS.className} 字已截斷`);
      r.className = clip(r.className, LIMITS.className);
    }
    if (r.grade && r.grade.length > LIMITS.gradeSnapshot) {
      warnings.push(`第 ${r._line} 列：年級超過 ${LIMITS.gradeSnapshot} 字已截斷（原值可能欄位錯位）`);
      r.grade = clip(r.grade, LIMITS.gradeSnapshot);
    }
    if (r.department && r.department.length > LIMITS.department) {
      r.department = clip(r.department, LIMITS.department);
    }
    if (r.college && r.college.length > LIMITS.college) {
      r.college = clip(r.college, LIMITS.college);
    }
    if (r.studentName && r.studentName.length > LIMITS.studentName) {
      warnings.push(`第 ${r._line} 列：姓名超過 ${LIMITS.studentName} 字已截斷`);
      r.studentName = clip(r.studentName, LIMITS.studentName);
    }
  }

  const seenIdToNames = new Map();
  for (const r of rawRows) {
    if (!r.studentId) continue;
    const nm = r.studentName || '';
    if (!seenIdToNames.has(r.studentId)) seenIdToNames.set(r.studentId, new Set());
    if (nm) seenIdToNames.get(r.studentId).add(nm);
  }

  const conflictIds = new Set();
  for (const [sid, set] of seenIdToNames) {
    if (set.size > 1) conflictIds.add(sid);
  }

  const seenRowKeys = new Set();
  let imported = 0;

  try {
    await sequelize.transaction(async (t) => {
      await ensureSemesterExists(sem, t);

      for (const r of rawRows) {
        if (!r.studentId) continue;
        if (!r.studentName) {
          warnings.push(`第 ${r._line} 列：缺少姓名，已略過`);
          continue;
        }
        if (r.studentId.length > LIMITS.studentIdStudents) {
          quarantine.push({
            reason: 'student_id_too_long',
            studentId: r.studentId.slice(0, 40),
            line: r._line,
            message: `學號超過 students.student_id 上限 ${LIMITS.studentIdStudents} 字元`,
          });
          continue;
        }
        if (conflictIds.has(r.studentId)) {
          quarantine.push({
            reason: 'same_student_id_different_name_in_file',
            studentId: r.studentId,
            line: r._line
          });
          continue;
        }

        const rk = rowKey(r);
        if (seenRowKeys.has(rk)) {
          warnings.push(`第 ${r._line} 列：與前面重複資料列，已略過`);
          continue;
        }
        seenRowKeys.add(rk);

        const existingStudent = await Student.findOne({
          where: { studentId: r.studentId },
          transaction: t
        });

        if (existingStudent && normName(existingStudent.nameZh) !== r.studentName) {
          quarantine.push({
            reason: 'student_id_name_mismatch_db',
            studentId: r.studentId,
            expectedName: normName(existingStudent.nameZh),
            importedName: r.studentName,
            line: r._line
          });
          continue;
        }

        const gradeNum = parseStudentGradeTinyint(r.grade);

        if (!existingStudent) {
          await Student.create(
            {
              studentId: r.studentId,
              nameZh: r.studentName,
              departmentName: clipOrNull(r.department, LIMITS.departmentName),
              collegeCode: clipOrNull(r.college, LIMITS.collegeCode),
              grade: gradeNum,
              status: 'active'
            },
            { transaction: t }
          );
        } else {
          await existingStudent.update(
            {
              nameZh: r.studentName,
              departmentName: clipOrNull(r.department, LIMITS.departmentName) || existingStudent.departmentName,
              collegeCode: clipOrNull(r.college, LIMITS.collegeCode) || existingStudent.collegeCode,
              grade: gradeNum != null ? gradeNum : existingStudent.grade
            },
            { transaction: t }
          );
        }

        const snapshotFields = {
          studentName: clipOrNull(r.studentName, LIMITS.studentName),
          department: clipOrNull(r.department, LIMITS.department),
          college: clipOrNull(r.college, LIMITS.college),
          className: clipOrNull(r.className, LIMITS.className),
          grade: clipOrNull(r.grade, LIMITS.gradeSnapshot),
          status: '在學',
          isActive: true,
          importBatchId: batchId,
          sourceType: 'learning_journey_v3_import',
          sourceBatchId: batchId
        };

        const [snap, created] = await EtEnrollmentSnapshot.findOrCreate({
          where: { semesterId: sem, studentId: r.studentId },
          defaults: snapshotFields,
          transaction: t
        });

        if (!created) {
          await snap.update(snapshotFields, { transaction: t });
        }

        imported += 1;
      }
    });
  } catch (err) {
    const mysqlCode = err?.original?.code || err?.parent?.code;
    const msg = String(err?.message || err);
    if (
      mysqlCode === 'ER_NO_REFERENCED_ROW_2' ||
      /foreign key constraint/i.test(msg)
    ) {
      const wrapped = new Error(
        `無法寫入名冊：學期「${sem}」尚未存在於系統（et_semesters）或關聯失敗。請重試；若仍失敗請聯絡系統管理員建立該學期。`,
      );
      wrapped.code = 'ENROLLMENT_SEMESTER_FK';
      wrapped.cause = err;
      throw wrapped;
    }
    if (mysqlCode === 'ER_DATA_TOO_LONG' || /Data too long for column/i.test(msg)) {
      const col = (msg.match(/column '([^']+)'/i) || [])[1] || '未知欄位';
      const wrapped = new Error(
        `名冊欄位過長無法寫入（${col}）。請確認 Excel 欄位順序為：系所、學院、班別、年級、學號、姓名；年級請短於 ${LIMITS.gradeSnapshot} 字。`,
      );
      wrapped.code = 'ENROLLMENT_DATA_TOO_LONG';
      wrapped.cause = err;
      throw wrapped;
    }
    throw err;
  }

  return {
    ok: true,
    semesterId: sem,
    batchId,
    imported,
    warnings,
    quarantine
  };
}

module.exports = {
  importEnrollment,
  ensureSemesterExists,
  LIMITS,
  parseStudentGradeTinyint,
};
