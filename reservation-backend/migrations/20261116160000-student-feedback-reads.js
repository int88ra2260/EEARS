'use strict';

/** 學生回報已讀時間。學生與行政各自一列，不改既有案件。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('student_feedback_reads', {
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
      readerType: {
        type: Sequelize.STRING(16),
        allowNull: false,
      },
      readerKey: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      lastReadAt: {
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
    await queryInterface.addIndex(
      'student_feedback_reads',
      ['feedbackId', 'readerType', 'readerKey'],
      { name: 'uq_student_feedback_reads_reader', unique: true },
    );
    await queryInterface.addIndex(
      'student_feedback_reads',
      ['readerType', 'readerKey'],
      { name: 'idx_student_feedback_reads_reader' },
    );
    await queryInterface.addConstraint('student_feedback_reads', {
      fields: ['feedbackId'],
      type: 'foreign key',
      name: 'fk_student_feedback_reads_case',
      references: { table: 'student_feedback', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('student_feedback_reads', 'fk_student_feedback_reads_case');
    await queryInterface.dropTable('student_feedback_reads');
  },
};
