'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lj_tracking_cohorts', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(80), allowNull: false },
      filters_json: { type: Sequelize.JSON, allowNull: false },
      snapshot_version: { type: Sequelize.STRING(120), allowNull: true },
      member_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      source_total: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      truncated: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_by: { type: Sequelize.INTEGER, allowNull: true },
      created_by_name: { type: Sequelize.STRING(100), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('lj_tracking_cohorts', ['created_at'], {
      name: 'idx_lj_tracking_cohorts_created_at',
    });

    await queryInterface.createTable('lj_tracking_cohort_members', {
      id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      cohort_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: { model: 'lj_tracking_cohorts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      student_id: { type: Sequelize.STRING(20), allowNull: false },
      student_name: { type: Sequelize.STRING(80), allowNull: true },
      department: { type: Sequelize.STRING(120), allowNull: true },
      enrollment_cohort: { type: Sequelize.STRING(10), allowNull: true },
      placement_label: { type: Sequelize.STRING(20), allowNull: true },
      exam_label: { type: Sequelize.STRING(10), allowNull: true },
      activity_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      course_hours: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('lj_tracking_cohort_members', ['cohort_id', 'student_id'], {
      name: 'uq_lj_tracking_cohort_members_student',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('lj_tracking_cohort_members');
    await queryInterface.dropTable('lj_tracking_cohorts');
  },
};
