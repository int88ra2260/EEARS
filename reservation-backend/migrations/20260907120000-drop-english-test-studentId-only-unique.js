'use strict';

/**
 * 移除 english_test_registrations 殘留的「僅學號」唯一鍵 UNIQUE KEY `studentId`。
 * 跨學期報名應只受 uk_student_semester (studentId, semester) 約束。
 *
 * 背景：20260323130000 只嘗試移除 uk_student_id，但實際殘留索引名可能是 studentId。
 */

async function hasUniqueStudentIdOnlyIndex(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(`
    SHOW INDEX FROM english_test_registrations
    WHERE Key_name = 'studentId' AND Non_unique = 0 AND Column_name = 'studentId'
  `);
  if (!rows.length) return false;

  const [allParts] = await queryInterface.sequelize.query(`
    SHOW INDEX FROM english_test_registrations
    WHERE Key_name = 'studentId'
  `);
  // 僅單欄 studentId 的 unique 才刪；避免誤刪其他同名複合索引
  return allParts.length === 1 && allParts[0].Column_name === 'studentId' && Number(allParts[0].Non_unique) === 0;
}

module.exports = {
  async up(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      if (await hasUniqueStudentIdOnlyIndex(queryInterface)) {
        await queryInterface.sequelize.query(
          'ALTER TABLE `english_test_registrations` DROP INDEX `studentId`',
          { transaction: t }
        );
        console.log('[migration] dropped UNIQUE KEY `studentId` on english_test_registrations');
      } else {
        console.log('[migration] UNIQUE KEY `studentId` not present; skip');
      }

      // 確保跨學期唯一約束存在
      const [composite] = await queryInterface.sequelize.query(`
        SHOW INDEX FROM english_test_registrations
        WHERE Key_name = 'uk_student_semester' AND Non_unique = 0
      `);
      if (!composite.length) {
        await queryInterface.addConstraint('english_test_registrations', {
          fields: ['studentId', 'semester'],
          type: 'unique',
          name: 'uk_student_semester',
          transaction: t,
        });
        console.log('[migration] added uk_student_semester');
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const t = await queryInterface.sequelize.transaction();
    try {
      // 回滾：還原僅學號唯一（會再次禁止跨學期多筆）
      const [existing] = await queryInterface.sequelize.query(`
        SHOW INDEX FROM english_test_registrations
        WHERE Key_name = 'studentId' AND Non_unique = 0
      `);
      if (!existing.length) {
        await queryInterface.sequelize.query(
          'ALTER TABLE `english_test_registrations` ADD UNIQUE KEY `studentId` (`studentId`)',
          { transaction: t }
        );
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
