'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const reservationCols = await queryInterface.describeTable('reservations').catch(() => null);
    if (reservationCols && !reservationCols.exclude_from_class_credit) {
      await queryInterface.addColumn('reservations', 'exclude_from_class_credit', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '到場不計點（未帶學生證）：已簽到但不計課堂加分與護照，活動結束檢查不記預約未到',
      });
    }
  },

  async down(queryInterface) {
    const reservationCols = await queryInterface.describeTable('reservations').catch(() => null);
    if (reservationCols?.exclude_from_class_credit) {
      await queryInterface.removeColumn('reservations', 'exclude_from_class_credit');
    }
  },
};
