'use strict';

const { Op } = require('sequelize');
const { LjAnalyticExam } = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { summarizeStudentExams } = require('./etExamObservation');

function studentKey(studentId) {
  return String(studentId || '').trim().toUpperCase();
}

async function loadLatestExamsByStudent(studentIds = []) {
  const unique = [...new Set(studentIds.map((id) => String(id || '').trim()).filter(Boolean))];
  let snapshotVersion = null;
  try {
    snapshotVersion = await resolveLatestSnapshotVersion();
  } catch (_err) {
    snapshotVersion = null;
  }
  const byStudent = new Map();
  if (!snapshotVersion || !unique.length) {
    return { snapshotVersion, byStudent };
  }

  let rows = [];
  try {
    rows = await LjAnalyticExam.findAll({
      where: {
        studentId: { [Op.in]: unique },
        snapshotVersion,
        excludeFlag: false,
      },
      attributes: [
        'id',
        'studentId',
        'examEventId',
        'examDate',
        'instrument',
        'skill',
        'rawScore',
        'previousRawScore',
        'previousExamEventId',
        'deltaRawScore',
        'retestFlag',
        'cefrLevel',
      ],
    });
  } catch (_err) {
    return { snapshotVersion, byStudent };
  }

  for (const row of rows) {
    const key = studentKey(row.studentId);
    if (!key) continue;
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(row);
  }
  return { snapshotVersion, byStudent };
}

function summaryForStudent(byStudent, studentId) {
  const exams = byStudent?.get(studentKey(studentId)) || [];
  return summarizeStudentExams(exams);
}

module.exports = {
  studentKey,
  loadLatestExamsByStudent,
  summaryForStudent,
};
