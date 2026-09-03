'use strict';

/** 停用候補：將既有 waiting 列改為 expired，不轉正 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE event_waitlist_entries
       SET status = 'expired',
           notes = 'waitlist_disabled',
           updatedAt = NOW()
       WHERE status = 'waiting'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE event_waitlist_entries
       SET status = 'waiting',
           notes = NULL,
           updatedAt = NOW()
       WHERE status = 'expired' AND notes = 'waitlist_disabled'`
    );
  },
};
