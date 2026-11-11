'use strict';

/**
 * 把名冊裡已能對照的私人使用區字改成標準漢字。
 * U+E28D→祐（李承祐、李祐丞、張祐齊），U+E03C→𦭳（林𦭳丞）。
 * 不改 students.student_id：部分列把姓名當成學號，改字後會撞上已存在的列。
 */
const REPLACEMENTS = [
  ['\uE03C', '𦭳'],
  ['\uE273', '祺'],
  ['\uE28D', '祐'],
];

const SKIP = new Set(['students.student_id']);

const YOU_STUDENT_IDS = ['B115040051', 'B125040007', 'B145090029'];
const YOU_COLUMNS = [
  ['class_memberships', 'studentName', 'studentId'],
  ['course_enrollments', 'student_name', 'student_id'],
  ['et_enrollment_snapshots', 'studentName', 'studentId'],
  ['et_student_master', 'name', 'studentId'],
  ['student_accounts', 'name', 'studentId'],
  ['students', 'name_zh', 'student_id'],
  ['english_test_student_idcard_roster_entries', 'nameZh', 'studentId'],
];

async function replaceInColumn(queryInterface, table, column, from, to) {
  await queryInterface.sequelize.query(
    `UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, ?, ?) WHERE \`${column}\` LIKE ?`,
    { replacements: [from, to, `%${from}%`] },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [columns] = await queryInterface.sequelize.query(`
      SELECT c.TABLE_NAME AS tableName, c.COLUMN_NAME AS columnName
      FROM information_schema.COLUMNS AS c
      INNER JOIN information_schema.TABLES AS t
        ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
      WHERE c.TABLE_SCHEMA = DATABASE()
        AND t.TABLE_TYPE = 'BASE TABLE'
        AND c.DATA_TYPE IN ('varchar', 'char', 'text', 'mediumtext', 'longtext', 'tinytext', 'json')
    `);

    for (const column of columns) {
      if (SKIP.has(`${column.tableName}.${column.columnName}`)) continue;
      for (const [from, to] of REPLACEMENTS) {
        const [countRows] = await queryInterface.sequelize.query(
          `SELECT COUNT(*) AS c FROM \`${column.tableName}\` WHERE \`${column.columnName}\` LIKE ?`,
          { replacements: [`%${from}%`] },
        );
        if (!Number(countRows[0].c)) continue;
        await replaceInColumn(queryInterface, column.tableName, column.columnName, from, to);
      }
    }
  },

  async down(queryInterface) {
    for (const [table, column, studentColumn] of YOU_COLUMNS) {
      await queryInterface.sequelize.query(
        `UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, '祐', ?) WHERE \`${studentColumn}\` IN (?)`,
        { replacements: ['\uE28D', YOU_STUDENT_IDS] },
      );
    }
    await queryInterface.sequelize.query(
      `UPDATE students SET name_zh = REPLACE(name_zh, '𦭳', ?) WHERE student_id = 'B155090019'`,
      { replacements: ['\uE03C'] },
    );
    await queryInterface.sequelize.query(
      `UPDATE et_enrollment_snapshots SET studentName = REPLACE(studentName, '𦭳', ?) WHERE studentId = 'B155090019'`,
      { replacements: ['\uE03C'] },
    );
    await queryInterface.sequelize.query(
      `UPDATE english_test_student_idcard_roster_entries SET nameZh = REPLACE(nameZh, '𦭳', ?) WHERE studentId = 'B155090019'`,
      { replacements: ['\uE03C'] },
    );
  },
};
