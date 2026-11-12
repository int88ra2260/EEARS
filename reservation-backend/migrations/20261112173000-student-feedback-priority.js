'use strict';

/** 學生回報的處理優先級。可空，不回填既有案件。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('student_feedback', 'priority', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
    await queryInterface.addIndex('student_feedback', ['priority', 'id'], {
      name: 'idx_student_feedback_priority',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('student_feedback', 'idx_student_feedback_priority');
    await queryInterface.removeColumn('student_feedback', 'priority');
  },
};
