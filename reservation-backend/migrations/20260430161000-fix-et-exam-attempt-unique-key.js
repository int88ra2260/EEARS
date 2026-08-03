'use strict';

/**
 * 修正 et_exam_attempts 唯一鍵規則：
 * - 錯誤（舊）：studentId + examType 或 studentId + testType
 * - 正確（新）：studentId + testType + testDate
 */

async function listIndexes(queryInterface, table) {
  const [rows] = await queryInterface.sequelize.query(`SHOW INDEX FROM \`${table}\``);
  return Array.isArray(rows) ? rows : [];
}

function groupIndexColumns(rows) {
  const map = new Map();
  for (const row of rows) {
    const name = row.Key_name;
    if (!map.has(name)) map.set(name, { unique: Number(row.Non_unique) === 0, cols: [] });
    map.get(name).cols.push({ seq: Number(row.Seq_in_index), col: row.Column_name });
  }
  for (const v of map.values()) {
    v.cols.sort((a, b) => a.seq - b.seq);
    v.cols = v.cols.map((x) => x.col);
  }
  return map;
}

function sameCols(a, b) {
  if (a.length !== b.length) return false;
  return a.every((x, i) => x === b[i]);
}

module.exports = {
  async up(queryInterface) {
    const table = 'et_exam_attempts';
    const rows = await listIndexes(queryInterface, table);
    const idxMap = groupIndexColumns(rows);

    for (const [name, meta] of idxMap.entries()) {
      if (!meta.unique) continue;
      if (sameCols(meta.cols, ['studentId', 'examType']) || sameCols(meta.cols, ['studentId', 'testType'])) {
        await queryInterface.removeIndex(table, name).catch(() => {});
      }
    }

    const [dupRows] = await queryInterface.sequelize.query(`
      SELECT studentId, testType, testDate, COUNT(*) AS c
      FROM et_exam_attempts
      GROUP BY studentId, testType, testDate
      HAVING c > 1
      LIMIT 1
    `);
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      throw new Error('et_exam_attempts 仍存在 studentId+testType+testDate 重複資料，請先去重後再建立唯一索引');
    }

    await queryInterface.addIndex(table, ['studentId', 'testType', 'testDate'], {
      unique: true,
      name: 'uk_et_attempts_student_type_date'
    }).catch(() => {});
  },

  async down(queryInterface) {
    const table = 'et_exam_attempts';
    await queryInterface.removeIndex(table, 'uk_et_attempts_student_type_date').catch(() => {});
  }
};

