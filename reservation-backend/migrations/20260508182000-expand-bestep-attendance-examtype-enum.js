'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bestep_attendance', 'examType', {
      type: Sequelize.ENUM('L', 'R', 'S', 'W', 'LR', 'SW'),
      allowNull: false,
      comment: '考試類型：L/R/S/W 單項或 LR/SW 組合'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('bestep_attendance', 'examType', {
      type: Sequelize.ENUM('LR', 'SW'),
      allowNull: false,
      comment: '考試類型：LR（聽讀）或 SW（說寫）'
    });
  }
};
