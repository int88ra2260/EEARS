'use strict';

/** 單一入口接手登入後，清掉學生在本站自設的密碼雜湊。無法還原原密碼。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('student_account_reviews', 'passwordHash', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      'UPDATE `student_accounts` SET `passwordHash` = NULL, `passwordChangedAt` = NULL WHERE `passwordHash` IS NOT NULL',
    );
    await queryInterface.sequelize.query(
      'UPDATE `student_account_reviews` SET `passwordHash` = NULL WHERE `passwordHash` IS NOT NULL',
    );
    await queryInterface.sequelize.query(
      'UPDATE `student_account_password_resets` SET `consumedAt` = NOW() WHERE `consumedAt` IS NULL',
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkUpdate(
      'student_account_reviews',
      { passwordHash: 'cleared' },
      { passwordHash: null },
    );
    await queryInterface.changeColumn('student_account_reviews', 'passwordHash', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
