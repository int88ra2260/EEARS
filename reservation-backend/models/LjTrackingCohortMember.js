'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LjTrackingCohortMember = sequelize.define('LjTrackingCohortMember', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  cohortId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'cohort_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  studentName: { type: DataTypes.STRING(80), allowNull: true, field: 'student_name' },
  department: { type: DataTypes.STRING(120), allowNull: true },
  enrollmentCohort: { type: DataTypes.STRING(10), allowNull: true, field: 'enrollment_cohort' },
  placementLabel: { type: DataTypes.STRING(20), allowNull: true, field: 'placement_label' },
  examLabel: { type: DataTypes.STRING(10), allowNull: true, field: 'exam_label' },
  activityHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'activity_hours' },
  courseHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'course_hours' },
}, {
  tableName: 'lj_tracking_cohort_members',
  underscored: true,
});

module.exports = LjTrackingCohortMember;
