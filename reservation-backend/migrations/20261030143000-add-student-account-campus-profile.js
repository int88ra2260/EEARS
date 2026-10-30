'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('student_accounts', 'campusProfile', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: '單一入口回傳、供報名表預填的學籍資料。不含密碼。',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('student_accounts', 'campusProfile');
  },
};
