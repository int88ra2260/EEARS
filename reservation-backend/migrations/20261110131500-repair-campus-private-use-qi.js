'use strict';

/**
 * 中山單一入口把「祺」回傳成 U+E273。已寫入的姓名改回標準漢字，
 * 讓帳號與名冊顯示「曾祺鈞」。不改 students.student_id，避免動到識別鍵。
 */
const FROM = '\uE273';
const TO = '祺';

const NAME_COLUMNS = [
  ['audit_logs', 'operatorName'],
  ['class_memberships', 'studentName'],
  ['course_enrollments', 'student_name'],
  ['course_enrollments', 'raw_payload'],
  ['english_test_student_idcard_roster_entries', 'nameZh'],
  ['et_enrollment_snapshots', 'studentName'],
  ['et_student_master', 'name'],
  ['student_accounts', 'name'],
  ['students', 'name_zh'],
];

const RESTORE_BY_STUDENT = [
  ['class_memberships', 'studentName', 'studentId'],
  ['course_enrollments', 'student_name', 'student_id'],
  ['course_enrollments', 'raw_payload', 'student_id'],
  ['english_test_student_idcard_roster_entries', 'nameZh', 'studentId'],
  ['et_enrollment_snapshots', 'studentName', 'studentId'],
  ['et_student_master', 'name', 'studentId'],
  ['student_accounts', 'name', 'studentId'],
  ['students', 'name_zh', 'student_id'],
];

async function replaceCharacter(queryInterface, table, column, from, to, whereSql, whereReplacements) {
  await queryInterface.sequelize.query(
    `UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, ?, ?) WHERE ${whereSql}`,
    { replacements: [from, to, ...whereReplacements] },
  );
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const [table, column] of NAME_COLUMNS) {
      await replaceCharacter(
        queryInterface,
        table,
        column,
        FROM,
        TO,
        `\`${column}\` LIKE ?`,
        [`%${FROM}%`],
      );
    }
  },

  async down(queryInterface) {
    await replaceCharacter(
      queryInterface,
      'audit_logs',
      'operatorName',
      TO,
      FROM,
      '`operatorName` LIKE ?',
      ['%曾祺鈞（B1***33）%'],
    );
    for (const [table, column, studentColumn] of RESTORE_BY_STUDENT) {
      await replaceCharacter(
        queryInterface,
        table,
        column,
        TO,
        FROM,
        `\`${studentColumn}\` = ? AND \`${column}\` LIKE ?`,
        ['B122030033', `%${TO}%`],
      );
    }
  },
};
