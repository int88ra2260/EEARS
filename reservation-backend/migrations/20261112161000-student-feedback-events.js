'use strict';

/** 學生回報的狀態與承辦變更事件。只新增資料表，不改既有案件列。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_feedback_events', {
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
      eventType: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      visibility: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'staff',
      },
      actorType: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      actorTeacherId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      actorStudentId: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      beforeValue: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      afterValue: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      requestId: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addIndex('student_feedback_events', ['feedbackId', 'createdAt', 'id'], {
      name: 'idx_student_feedback_events_timeline',
    });
    await queryInterface.addConstraint('student_feedback_events', {
      fields: ['feedbackId'],
      type: 'foreign key',
      name: 'fk_student_feedback_events_case',
      references: { table: 'student_feedback', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('student_feedback_events', {
      fields: ['actorTeacherId'],
      type: 'foreign key',
      name: 'fk_student_feedback_events_teacher',
      references: { table: 'teachers', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('student_feedback_events', 'fk_student_feedback_events_teacher');
    await queryInterface.removeConstraint('student_feedback_events', 'fk_student_feedback_events_case');
    await queryInterface.dropTable('student_feedback_events');
  },
};
