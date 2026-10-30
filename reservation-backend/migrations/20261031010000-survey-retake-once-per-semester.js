'use strict';

/**
 * 既有 once_ever 的完成判定本來就依當學期。
 * 把儲存值改成 once_per_semester，並補上後台「填寫次數」欄位，讓名稱與行為一致。
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE survey_rules
      SET retakePolicy = 'once_per_semester'
      WHERE retakePolicy IS NULL OR retakePolicy = '' OR retakePolicy = 'once_ever'
    `);
    await queryInterface.sequelize.query(`
      UPDATE survey_rules
      SET fillScope = 'once_per_semester'
      WHERE fillScope IS NULL OR fillScope = '' OR fillScope = 'once_ever'
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE survey_rules
      SET retakePolicy = 'once_ever'
      WHERE retakePolicy = 'once_per_semester'
    `);
  },
};
