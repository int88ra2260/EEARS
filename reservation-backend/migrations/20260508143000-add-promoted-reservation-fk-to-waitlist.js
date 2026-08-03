'use strict';

/**
 * 補上候補轉正欄位 FK：
 * event_waitlist_entries.promotedReservationId -> reservations.id
 */
module.exports = {
  async up(queryInterface, _Sequelize) {
    const table = await queryInterface.describeTable('event_waitlist_entries');
    if (!table.promotedReservationId) {
      throw new Error('event_waitlist_entries.promotedReservationId 欄位不存在，請先執行 waitlist create table migration');
    }

    await queryInterface.addConstraint('event_waitlist_entries', {
      fields: ['promotedReservationId'],
      type: 'foreign key',
      name: 'fk_waitlist_promoted_reservation_id',
      references: {
        table: 'reservations',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeConstraint(
      'event_waitlist_entries',
      'fk_waitlist_promoted_reservation_id'
    );
  },
};
