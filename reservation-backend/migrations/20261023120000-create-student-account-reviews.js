'use strict';

/** 名冊未涵蓋的學生帳號申請。未核准前不寫入 student_accounts，因此不佔用學號或信箱。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_account_reviews', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      studentId: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      passwordHash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      reviewedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('student_account_reviews', ['status', 'createdAt'], {
      name: 'idx_student_account_reviews_status_created',
    });
    await queryInterface.addIndex('student_account_reviews', ['studentId'], {
      name: 'idx_student_account_reviews_student_id',
    });
    await queryInterface.addIndex('student_account_reviews', ['email'], {
      name: 'idx_student_account_reviews_email',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_account_reviews');
  },
};
