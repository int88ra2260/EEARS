'use strict';

/** 學生回報改為案件：狀態、是否要求回覆、指派、對話。附件待防毒掃描後再加。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('student_feedback', 'status', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    });
    await queryInterface.addColumn('student_feedback', 'replyRequested', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await queryInterface.addColumn('student_feedback', 'assignedTeacherId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('student_feedback', 'closedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('student_feedback', ['status', 'createdAt'], {
      name: 'idx_student_feedback_status_created',
    });
    await queryInterface.addIndex('student_feedback', ['assignedTeacherId'], {
      name: 'idx_student_feedback_assignee',
    });
    await queryInterface.addConstraint('student_feedback', {
      fields: ['assignedTeacherId'],
      type: 'foreign key',
      name: 'fk_student_feedback_assignee',
      references: { table: 'teachers', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.createTable('student_feedback_messages', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      feedbackId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      authorType: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      visibility: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      teacherId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      studentId: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      emailStatus: {
        type: Sequelize.STRING(20),
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
    await queryInterface.addIndex('student_feedback_messages', ['feedbackId', 'createdAt'], {
      name: 'idx_student_feedback_messages_case',
    });
    await queryInterface.addIndex('student_feedback_messages', ['studentId', 'createdAt'], {
      name: 'idx_student_feedback_messages_student',
    });
    await queryInterface.addConstraint('student_feedback_messages', {
      fields: ['feedbackId'],
      type: 'foreign key',
      name: 'fk_student_feedback_messages_case',
      references: { table: 'student_feedback', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('student_feedback_messages', {
      fields: ['teacherId'],
      type: 'foreign key',
      name: 'fk_student_feedback_messages_teacher',
      references: { table: 'teachers', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('student_feedback_messages', 'fk_student_feedback_messages_teacher');
    await queryInterface.removeConstraint('student_feedback_messages', 'fk_student_feedback_messages_case');
    await queryInterface.dropTable('student_feedback_messages');
    await queryInterface.removeConstraint('student_feedback', 'fk_student_feedback_assignee');
    await queryInterface.removeIndex('student_feedback', 'idx_student_feedback_assignee');
    await queryInterface.removeIndex('student_feedback', 'idx_student_feedback_status_created');
    await queryInterface.removeColumn('student_feedback', 'closedAt');
    await queryInterface.removeColumn('student_feedback', 'assignedTeacherId');
    await queryInterface.removeColumn('student_feedback', 'replyRequested');
    await queryInterface.removeColumn('student_feedback', 'status');
  },
};
