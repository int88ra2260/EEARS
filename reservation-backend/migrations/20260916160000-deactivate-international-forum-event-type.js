'use strict';

/** International Forum 已停辦：前台僅顯示 is_active 類型，故停用而非刪除（保留歷史活動引用）。 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE event_types SET is_active = 0 WHERE code = 'international_forum'"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE event_types SET is_active = 1 WHERE code = 'international_forum'"
    );
  },
};
