const { Op } = require('sequelize');
const { runStage, recordQuarantine } = require('./migrationCommonService');
const {
  BestepExamScore,
  Student,
  EtEnrollmentSnapshot,
  EnglishTestStudentIdCardRosterEntry,
  CourseEnrollment
} = require('../../../models');
const { normalizeStudentId } = require('../utils/studentNormalization');

function cleanDisplayName(value, studentId) {
  const name = String(value || '').trim();
  if (!name || name === studentId) return '';
  return name.slice(0, 120);
}

function pickDisplayName(studentId, sources = {}) {
  return cleanDisplayName(sources.rosterName, studentId)
    || cleanDisplayName(sources.snapshotName, studentId)
    || cleanDisplayName(sources.courseName, studentId)
    || studentId;
}

async function loadDisplayNames(studentIds) {
  const names = new Map();
  if (!studentIds.length) return names;

  const rosterRows = await EnglishTestStudentIdCardRosterEntry.findAll({
    where: { studentId: { [Op.in]: studentIds } },
    attributes: ['studentId', 'nameZh'],
    raw: true
  });
  for (const row of rosterRows) {
    const name = cleanDisplayName(row.nameZh, row.studentId);
    if (name) names.set(row.studentId, { rosterName: name });
  }

  const snapshots = await EtEnrollmentSnapshot.findAll({
    where: { studentId: { [Op.in]: studentIds } },
    attributes: ['studentId', 'studentName', 'semesterId'],
    order: [['semesterId', 'DESC']],
    raw: true
  });
  for (const row of snapshots) {
    const name = cleanDisplayName(row.studentName, row.studentId);
    if (!name) continue;
    const current = names.get(row.studentId) || {};
    if (!current.snapshotName) {
      current.snapshotName = name;
      names.set(row.studentId, current);
    }
  }

  const courses = await CourseEnrollment.findAll({
    where: { studentId: { [Op.in]: studentIds } },
    attributes: ['studentId', 'studentName', 'updatedAt'],
    order: [['updatedAt', 'DESC']],
    raw: true
  });
  for (const row of courses) {
    const name = cleanDisplayName(row.studentName, row.studentId);
    if (!name) continue;
    const current = names.get(row.studentId) || {};
    if (!current.courseName) {
      current.courseName = name;
      names.set(row.studentId, current);
    }
  }

  return names;
}

async function migrateStudents(batchContext) {
  return runStage('students', batchContext, async (ctx) => {
    if (ctx.options && ctx.options.simulateFailureStage === 'students') {
      throw new Error('Simulated failure in students stage');
    }

    const rows = await BestepExamScore.findAll({
      attributes: ['id', 'studentId'],
      raw: true
    });

    const distinctStudentIds = new Set();
    const stats = {
      processed: rows.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      duplicate: 0,
      quarantined: 0,
      errors: 0,
      warnings: 0
    };

    for (const row of rows) {
      const normalizedStudentId = normalizeStudentId(row.studentId);
      if (!normalizedStudentId) {
        await recordQuarantine(ctx, {
          stageName: 'students',
          sourceType: 'bestep_exam_scores',
          sourceRef: String(row.id),
          studentId: row.studentId || null,
          reasonCode: 'INVALID_STUDENT_ID',
          reasonMessage: 'studentId is empty after normalization',
          rawPayload: row
        });
        stats.quarantined += 1;
        continue;
      }
      distinctStudentIds.add(normalizedStudentId);
    }

    if (!distinctStudentIds.size) {
      return {
        stats,
        message: 'no valid student ids found in bestep_exam_scores',
        payload: { distinctStudentIds: 0 }
      };
    }

    const studentIds = Array.from(distinctStudentIds);
    const existingStudents = await Student.findAll({
      where: { studentId: { [Op.in]: studentIds } },
      attributes: ['id', 'studentId', 'nameZh'],
      raw: true
    });
    const existingById = new Map(existingStudents.map((row) => [row.studentId, row]));

    const displayNames = await loadDisplayNames(studentIds);
    const studentsToInsert = [];
    for (const studentId of studentIds) {
      const existing = existingById.get(studentId);
      if (existing) {
        stats.duplicate += 1;
        const placeholder = !existing.nameZh || existing.nameZh === studentId;
        const nameZh = pickDisplayName(studentId, displayNames.get(studentId));
        if (placeholder && nameZh !== studentId) {
          await Student.update(
            { nameZh },
            { where: { id: existing.id, nameZh: existing.nameZh || studentId } }
          );
          stats.updated += 1;
        }
        continue;
      }
      studentsToInsert.push({
        studentId,
        nameZh: pickDisplayName(studentId, displayNames.get(studentId)),
        status: 'active'
      });
    }

    if (studentsToInsert.length) {
      await Student.bulkCreate(studentsToInsert);
      stats.inserted = studentsToInsert.length;
    }

    return {
      stats,
      message: 'students migrated from bestep_exam_scores',
      payload: {
        sourceRows: rows.length,
        distinctStudentIds: studentIds.length,
        inserted: stats.inserted,
        duplicates: stats.duplicate
      }
    };
  });
}

module.exports = {
  migrateStudents,
  pickDisplayName
};
