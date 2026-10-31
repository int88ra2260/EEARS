'use strict';

/** 學生帳號須驗證收信信箱後才算啟動。既有帳號一律視為尚未驗證。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('student_accounts', 'emailVerifiedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('student_accounts', 'emailVerifiedAt');
  },
};
