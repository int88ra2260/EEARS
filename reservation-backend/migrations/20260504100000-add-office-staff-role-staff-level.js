'use strict';

/**
 * 新增角色 office_staff（行政職員）與職務欄位 staffLevel。
 * MySQL：以 raw SQL 擴充 ENUM，避免 Sequelize alter 與既有 enum 型別衝突。
 */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('teachers');

    if (!table.staffLevel) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` ADD COLUMN `staffLevel` ENUM('event_lead','curriculum_lead','bestep_lead','deputy_manager') NULL COMMENT '行政職員職務（僅 role=office_staff）' AFTER `teacherLevel`"
      );
    }

    if (table.role) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` MODIFY COLUMN `role` ENUM('admin','worker','teacher','office_staff') NOT NULL DEFAULT 'teacher'"
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('teachers');
    if (table.staffLevel) {
      await queryInterface.sequelize.query(
        "UPDATE `teachers` SET `role` = 'teacher', `staffLevel` = NULL WHERE `role` = 'office_staff'"
      );
      await queryInterface.removeColumn('teachers', 'staffLevel');
    }
    if (table.role) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` MODIFY COLUMN `role` ENUM('admin','worker','teacher') NOT NULL DEFAULT 'teacher'"
      );
    }
  },
};
