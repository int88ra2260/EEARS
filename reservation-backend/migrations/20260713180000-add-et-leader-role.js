'use strict';

/**
 * 新增 ET Leader 角色（學生桌長後台帳號）與選填學號欄位。
 */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('teachers');

    if (!table.studentId) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` ADD COLUMN `studentId` VARCHAR(20) NULL COMMENT '學號（主要供 role=leader）' AFTER `username`"
      );
    }

    if (table.role) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` MODIFY COLUMN `role` ENUM('admin','worker','teacher','office_staff','leader') NOT NULL DEFAULT 'teacher'"
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('teachers');
    if (table.role) {
      await queryInterface.sequelize.query(
        "UPDATE `teachers` SET `role` = 'worker' WHERE `role` = 'leader'"
      );
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` MODIFY COLUMN `role` ENUM('admin','worker','teacher','office_staff') NOT NULL DEFAULT 'teacher'"
      );
    }
    if (table.studentId) {
      await queryInterface.removeColumn('teachers', 'studentId');
    }
  },
};
