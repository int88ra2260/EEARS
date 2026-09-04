'use strict';

/**
 * Teacher.isDemo：DEMO 帳號可登入看後台功能，但不可寫入、列表回傳空資料。
 */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('teachers');
    if (!table.isDemo) {
      await queryInterface.sequelize.query(
        "ALTER TABLE `teachers` ADD COLUMN `isDemo` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'DEMO 帳號：可看功能、不顯示真實資料' AFTER `isActive`"
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('teachers');
    if (table.isDemo) {
      await queryInterface.removeColumn('teachers', 'isDemo');
    }
  },
};
