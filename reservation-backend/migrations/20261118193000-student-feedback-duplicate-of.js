'use strict';

/** 學生回報可指向另一筆重複案件。可空，不回填、不刪除原案件。 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('student_feedback', 'duplicateOfId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex('student_feedback', ['duplicateOfId'], {
      name: 'idx_student_feedback_duplicate_of',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('student_feedback', 'idx_student_feedback_duplicate_of');
    await queryInterface.removeColumn('student_feedback', 'duplicateOfId');
  },
};
