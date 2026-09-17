'use strict';

/**
 * 培力英檢報名「列表顯示編號」：與前端 EnhancedTable／QuickReview 一致。
 * semesterSequence（學期內動態連號，不存 DB）→ success 時 successSequence → id
 */

const { QueryTypes } = require('sequelize');

/**
 * @param {object} reg - 含 id / status / successSequence / semesterSequence
 * @returns {number|string}
 */
function resolveDisplayRegistrationNumber(reg) {
  if (!reg) return '';
  if (reg.semesterSequence != null && reg.semesterSequence !== '') {
    const n = Number(reg.semesterSequence);
    return Number.isFinite(n) ? n : reg.semesterSequence;
  }
  if (reg.status === 'success' && reg.successSequence != null && reg.successSequence !== '') {
    return reg.successSequence;
  }
  return reg.id;
}

/**
 * 匯出用連號：依目前篩選結果的列順序重編 1..N（與列表 semesterSequence 無關）。
 * Excel 與證件照必須共用同一份有序 rows，序號才會對齊。
 * @param {Array<object>} rows
 * @returns {object[]} plain objects with exportSequence
 */
function assignExportSequentialNumbers(rows) {
  return (rows || []).map((row, index) => {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    plain.exportSequence = index + 1;
    return plain;
  });
}

/**
 * 為報名列計算 semesterSequence（相對該學期「全部」報名，非目前篩選子集）。
 * @param {import('sequelize').Sequelize} sequelize
 * @param {Array<object>} rows - Sequelize model 或 plain（需有 id、semester）
 * @param {{ semesterFilter?: string|null }} [options]
 * @returns {Promise<Map<number, number>>}
 */
async function buildSemesterSequenceMap(sequelize, rows, { semesterFilter = null } = {}) {
  const map = new Map();
  const rowIds = (rows || []).map((row) => row.id).filter((id) => id != null);
  if (rowIds.length === 0) return map;

  const semesters = [...new Set((rows || []).map((row) => row.semester).filter(Boolean))];
  const targetSemester = semesterFilter || (semesters.length === 1 ? semesters[0] : null);
  const replacements = { rowIds };

  let sequenceQuery;
  if (targetSemester) {
    sequenceQuery = `
      SELECT ranked.id, ranked.semesterSequence
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY semester
            ORDER BY createdAt ASC, id ASC
          ) AS semesterSequence
        FROM english_test_registrations
        WHERE semester = :targetSemester
      ) ranked
      WHERE ranked.id IN (:rowIds)
    `;
    replacements.targetSemester = targetSemester;
  } else {
    sequenceQuery = `
      SELECT ranked.id, ranked.semesterSequence
      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY semester
            ORDER BY createdAt ASC, id ASC
          ) AS semesterSequence
        FROM english_test_registrations
      ) ranked
      WHERE ranked.id IN (:rowIds)
    `;
  }

  const sequenceResults = await sequelize.query(sequenceQuery, {
    replacements,
    type: QueryTypes.SELECT,
  });

  sequenceResults.forEach((result) => {
    map.set(result.id, result.semesterSequence);
  });

  return map;
}

/**
 * @param {import('sequelize').Sequelize} sequelize
 * @param {Array<object>} rows
 * @param {{ semesterFilter?: string|null }} [options]
 * @returns {Promise<object[]>} plain objects with semesterSequence
 */
async function attachSemesterSequences(sequelize, rows, options = {}) {
  const map = await buildSemesterSequenceMap(sequelize, rows, options);
  return (rows || []).map((row) => {
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    plain.semesterSequence = map.has(plain.id) ? map.get(plain.id) : null;
    return plain;
  });
}

module.exports = {
  resolveDisplayRegistrationNumber,
  assignExportSequentialNumbers,
  buildSemesterSequenceMap,
  attachSemesterSequences,
};
