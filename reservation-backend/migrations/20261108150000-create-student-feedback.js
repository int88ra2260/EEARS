'use strict';

/** 學生帳號頁的問題回報與建議／許願。只給中心查看，不公開。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_feedback', {
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
      studentName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      emailVerified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      kind: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      category: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      emailStatus: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
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

    await queryInterface.addIndex('student_feedback', ['studentId', 'createdAt'], {
      name: 'idx_student_feedback_student_created',
    });
    await queryInterface.addIndex('student_feedback', ['createdAt'], {
      name: 'idx_student_feedback_created',
    });
    await queryInterface.addIndex('student_feedback', ['kind', 'createdAt'], {
      name: 'idx_student_feedback_kind_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('student_feedback');
  },
};
