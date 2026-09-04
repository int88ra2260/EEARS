'use strict';

/** 英語實踐歷程護照：申請前信箱 OTP（明文驗證碼不入庫，只存 hash） */

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface
      .describeTable('english_learning_passport_email_verifications')
      .catch(() => null);
    if (exists) return;

    await queryInterface.createTable('english_learning_passport_email_verifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: '正規化後的 email（小寫）',
      },
      studentId: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: '可選學號，用於對照申請',
      },
      codeHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        comment: '驗證碼 HMAC-SHA256',
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

    await queryInterface.addIndex('english_learning_passport_email_verifications', ['email'], {
      name: 'idx_elp_email_verif_email',
    });
    await queryInterface.addIndex('english_learning_passport_email_verifications', ['expiresAt'], {
      name: 'idx_elp_email_verif_expires',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('english_learning_passport_email_verifications').catch(() => {});
  },
};
