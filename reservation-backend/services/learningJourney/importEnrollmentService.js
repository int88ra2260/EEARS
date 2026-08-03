'use strict';

const XLSX = require('xlsx');
const { sequelize, Student, EtEnrollmentSnapshot } = require('../../models');

function normSid(s) {
  return String(s || '').trim().toUpperCase();
}

function normName(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function rowKey(r) {
  return [r.department, r.college, r.className, r.grade, r.studentId, r.studentName].join('|');
}

/**
 * @param {Buffer|ArrayBuffer} file
 * @param {string} semesterId
 * @param {{ batchId?: string }} options
 * @returns {Promise<object>}
 */
async function importEnrollment(file, semesterId, options = {}) {
  const sem = String(semesterId || '').trim();
  const batchId = String(options.batchId || '').trim() || `v3-enroll:${sem}:${Date.now()}`;
  if (!sem) {
    return { ok: false, error: 'semesterId 必填', warnings: [], quarantine: [], imported: 0 };
  }

  const warnings = [];
  const quarantine = [];
  const workbook = XLSX.read(file, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

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
    rawRows.push({
      department: normName(row[0] || ''),
      college: normName(row[1] || ''),
      className: normName(row[2] || ''),
      grade: normName(row[3] || ''),
      studentId: normSid(row[4]),
      studentName: normName(row[5] || ''),
      _line: i + 1
    });
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

  await sequelize.transaction(async (t) => {
    for (const r of rawRows) {
      if (!r.studentId) continue;
      if (!r.studentName) {
        warnings.push(`第 ${r._line} 列：缺少姓名，已略過`);
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

      let gradeNum = null;
      const g = String(r.grade || '').trim();
      if (g !== '') {
        const n = parseInt(g, 10);
        gradeNum = Number.isFinite(n) ? n : null;
      }

      if (!existingStudent) {
        await Student.create(
          {
            studentId: r.studentId,
            nameZh: r.studentName,
            departmentName: r.department || null,
            collegeCode: r.college ? String(r.college).slice(0, 20) : null,
            grade: gradeNum,
            status: 'active'
          },
          { transaction: t }
        );
      } else {
        await existingStudent.update(
          {
            nameZh: r.studentName,
            departmentName: r.department || existingStudent.departmentName,
            collegeCode: r.college ? String(r.college).slice(0, 20) : existingStudent.collegeCode,
            grade: gradeNum != null ? gradeNum : existingStudent.grade
          },
          { transaction: t }
        );
      }

      const [snap, created] = await EtEnrollmentSnapshot.findOrCreate({
        where: { semesterId: sem, studentId: r.studentId },
        defaults: {
          studentName: r.studentName,
          department: r.department || null,
          college: r.college || null,
          className: r.className || null,
          grade: r.grade || null,
          isActive: true,
          sourceType: 'learning_journey_v3_import',
          sourceBatchId: batchId
        },
        transaction: t
      });

      if (!created) {
        await snap.update(
          {
            studentName: r.studentName,
            department: r.department || null,
            college: r.college || null,
            className: r.className || null,
            grade: r.grade || null,
            isActive: true,
            sourceType: 'learning_journey_v3_import',
            sourceBatchId: batchId
          },
          { transaction: t }
        );
      }

      imported += 1;
    }
  });

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
  importEnrollment
};
