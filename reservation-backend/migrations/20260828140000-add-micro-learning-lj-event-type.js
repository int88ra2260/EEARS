'use strict';

const TABLE = 'lj_student_events';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TABLE, 'event_type', {
      type: Sequelize.ENUM(
        'baseline_score',
        'exam_event',
        'course_event',
        'activity_event',
        'micro_learning_event',
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TABLE, 'event_type', {
      type: Sequelize.ENUM(
        'baseline_score',
        'exam_event',
        'course_event',
        'activity_event',
      ),
      allowNull: false,
    });
  },
};
