'use strict';

const { Op } = require('sequelize');
const { LjAnalyticStudent } = require('../../models');
const { cefrToGseMidpoint } = require('../learningAnalytics/gseScoreMappingService');
const {
  normalizeCefrKey,
  CEFR_DISPLAY_LABELS,
} = require('../learningAnalytics/learningAnalyticsCefrUtils');

const CEFR_ORDER = ['BELOW_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function resolveDataQuality(row) {
  if (!row) return 'missing';
  if (row.bestCefr) return 'high';
  if (row.baselineCefr || row.baselineEnglishScore != null) return 'baseline_only';
  return 'missing';
}

function pickCefr(row) {
  if (!row) return null;
  return row.bestCefr || row.baselineCefr || null;
}

function gseFromCefr(cefr) {
  return cefrToGseMidpoint(cefr);
}

function formatCefrDisplay(cefr) {
  const key = normalizeCefrKey(cefr);
  if (!key) return null;
  return CEFR_DISPLAY_LABELS[key] || key;
}

function buildSnapshot(studentId, row) {
  const cefr = pickCefr(row);
  const dataQuality = resolveDataQuality(row);
  const gse = cefr ? gseFromCefr(cefr) : null;

  return {
    studentId: String(studentId),
    cefr,
    cefrDisplay: formatCefrDisplay(cefr),
    gse,
    dataQuality,
    derivedAt: row?.derivedAt || null,
    snapshotVersion: row?.snapshotVersion || null,
    hasLjRecord: Boolean(row),
  };
}

async function getGseSnapshotForStudent(studentId) {
  const row = await LjAnalyticStudent.findOne({ where: { studentId: String(studentId) } });
  return buildSnapshot(studentId, row);
}

async function getGseSnapshotsForStudents(studentIds = []) {
  const unique = [...new Set(studentIds.map((id) => String(id)).filter(Boolean))];
  if (!unique.length) return new Map();

  const rows = await LjAnalyticStudent.findAll({
    where: { studentId: { [Op.in]: unique } },
  });
  const byStudent = new Map(rows.map((row) => [String(row.studentId), row]));

  const result = new Map();
  for (const studentId of unique) {
    result.set(studentId, buildSnapshot(studentId, byStudent.get(studentId) || null));
  }
  return result;
}

function compareCefr(a, b) {
  const ka = normalizeCefrKey(a);
  const kb = normalizeCefrKey(b);
  const ia = CEFR_ORDER.indexOf(ka);
  const ib = CEFR_ORDER.indexOf(kb);
  return (ia === -1 ? 0 : ia) - (ib === -1 ? 0 : ib);
}

module.exports = {
  getGseSnapshotForStudent,
  getGseSnapshotsForStudents,
  compareCefr,
  CEFR_ORDER,
};
