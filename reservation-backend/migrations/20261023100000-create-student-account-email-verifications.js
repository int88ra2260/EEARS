'use strict';

/** 學生帳號註冊：信箱 OTP 暫存（明文驗證碼不入庫，只存 hash） */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_account_email_verifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      studentId: {
        type: Sequelize.STRING(20),
        allowNull: true,
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

    await queryInterface.addIndex('student_account_email_verifications', ['email'], {
      name: 'idx_student_account_email_verif_email',
    });
    await queryInterface.addIndex('student_account_email_verifications', ['expiresAt'], {
      name: 'idx_student_account_email_verif_expires',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_account_email_verifications');
  },
};
