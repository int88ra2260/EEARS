'use strict';

const { Class, ClassMembership } = require('../models');
const { newImportBatchId } = require('../utils/importBatchId');
const importRollbackManifestService = require('./importRollbackManifestService');
const auditLogService = require('./auditLogService');

function cleanStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function cleanString(value) {
  const s = String(value || '').trim();
  return s || null;
}

/**
 * 將已結構化的學生名單寫入 Class / ClassMembership。
 * @param {{
 *   semester: string,
 *   className: string,
 *   teacherName: string,
 *   students: Array<{studentId:string,studentName:string,department?:string|null,email?:string|null,grade?:number|null}>,
 *   source?: string,
 *   req?: object,
 * }} options
 */
async function applyStructuredClassRosterImport(options = {}) {
  const semester = cleanString(options.semester);
  const className = cleanString(options.className);
  const teacherName = cleanString(options.teacherName);
  const students = Array.isArray(options.students) ? options.students : [];
  const source = options.source || 'structured';
  const req = options.req || null;

  if (!semester) {
    const err = new Error('請指定學期');
    err.status = 400;
    throw err;
  }
  if (!className) {
    const err = new Error('請指定課程／班級名稱');
    err.status = 400;
    throw err;
  }
  if (!teacherName) {
    const err = new Error('請指定老師姓名');
    err.status = 400;
    throw err;
  }
  if (!students.length) {
    const err = new Error('沒有可匯入的學生資料');
    err.status = 422;
    throw err;
  }

  let classesCreated = 0;
  let classesUpdated = 0;
  let membersUpserted = 0;
  let skipped = 0;
  const warnings = [];
  const importBatchId = newImportBatchId('class-roster', semester);
  const createdMembershipIds = [];
  const updatedSnapshots = [];
  let resolvedClassId = null;

  const [classRecord, classCreated] = await Class.findOrCreate({
    where: { name: className, semester },
    defaults: { name: className, semester, teacherName },
  });
  if (classCreated) {
    classesCreated = 1;
  } else {
    classesUpdated = 1;
    if (teacherName && classRecord.teacherName !== teacherName) {
      await classRecord.update({ teacherName });
    }
  }
  resolvedClassId = classRecord.id;

  for (let i = 0; i < students.length; i += 1) {
    const row = students[i];
    const rowNum = i + 1;
    try {
      const studentId = cleanStudentId(row.studentId);
      const studentName = cleanString(row.studentName);
      const department = cleanString(row.department);
      const email = cleanString(row.email);
      const grade = row.grade == null || row.grade === ''
        ? null
        : (Number.isFinite(Number(row.grade)) ? Number(row.grade) : null);

      if (!studentId || !studentName) {
        warnings.push(`第 ${rowNum} 筆：缺少必要欄位（學號或姓名）`);
        skipped += 1;
        continue;
      }

      const existingMembership = await ClassMembership.findOne({
        where: { semester, classId: classRecord.id, studentId },
      });
      if (existingMembership) {
        updatedSnapshots.push({
          id: existingMembership.id,
          studentId: existingMembership.studentId,
          studentName: existingMembership.studentName,
          department: existingMembership.department,
          email: existingMembership.email,
          grade: existingMembership.grade,
        });
      }

      await ClassMembership.upsert({
        semester,
        classId: classRecord.id,
        studentId,
        studentName,
        department,
        email,
        grade,
      });

      if (!existingMembership) {
        const createdMembership = await ClassMembership.findOne({
          where: { semester, classId: classRecord.id, studentId },
          attributes: ['id'],
        });
        if (createdMembership?.id) createdMembershipIds.push(createdMembership.id);
      }

      membersUpserted += 1;
    } catch (error) {
      warnings.push(`第 ${rowNum} 筆處理失敗：${error.message}`);
      skipped += 1;
    }
  }

  if (resolvedClassId && (createdMembershipIds.length || updatedSnapshots.length)) {
    await importRollbackManifestService.saveManifest({
      importBatchId,
      sourceModule: 'admin_classes',
      kind: 'class_roster',
      manifest: {
        kind: 'class_roster',
        classId: resolvedClassId,
        semester,
        className,
        createdMembershipIds,
        updatedSnapshots,
        source,
      },
    });
  }

  auditLogService.logAuditAsync({
    module: 'admin_classes',
    action: 'import_class_roster',
    entityType: 'ClassRosterImport',
    entityId: `${semester}:${className}:${teacherName}`,
    targetSummary: `semester=${semester}, className=${className}, source=${source}`,
    afterData: {
      importBatchId,
      classId: resolvedClassId,
      semester,
      className,
      teacherName,
      source,
      classesCreated,
      classesUpdated,
      membersUpserted,
      skipped,
      warningsCount: warnings.length,
    },
    req,
  });

  return {
    ok: true,
    semester,
    className,
    teacherName,
    importBatchId,
    classId: resolvedClassId,
    classesCreated,
    classesUpdated,
    membersUpserted,
    skipped,
    warnings,
    source,
  };
}

module.exports = {
  applyStructuredClassRosterImport,
  cleanStudentId,
  cleanString,
};
