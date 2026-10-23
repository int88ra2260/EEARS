'use strict';

/** 學生忘記密碼：驗證碼只存 hash，與註冊信箱驗證分開。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_account_password_resets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      studentAccountId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      studentId: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      codeHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      attemptCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      consumedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastSentAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('student_account_password_resets', ['studentAccountId'], {
      name: 'idx_student_pw_reset_account',
    });
    await queryInterface.addIndex('student_account_password_resets', ['studentId'], {
      name: 'idx_student_pw_reset_student_id',
    });
    await queryInterface.addIndex('student_account_password_resets', ['expiresAt'], {
      name: 'idx_student_pw_reset_expires',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_account_password_resets');
  },
};
