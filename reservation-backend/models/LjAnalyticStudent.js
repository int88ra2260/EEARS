'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LjAnalyticStudent = sequelize.define('LjAnalyticStudent', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  cohort: { type: DataTypes.STRING(10), allowNull: true },
  enrollmentTerm: { type: DataTypes.STRING(12), allowNull: true, field: 'enrollment_term' },
  college: { type: DataTypes.STRING(120), allowNull: true },
  department: { type: DataTypes.STRING(120), allowNull: true },
  admissionType: { type: DataTypes.STRING(40), allowNull: true, field: 'admission_type' },
  isOverseasStudent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_overseas_student' },
  baselineEnglishScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'baseline_english_score' },
  baselineLevel: { type: DataTypes.STRING(20), allowNull: true, field: 'baseline_level' },
  baselineCefr: { type: DataTypes.STRING(10), allowNull: true, field: 'baseline_cefr' },
  examCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'exam_count' },
  retestFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'retest_flag' },
  firstExamDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'first_exam_date' },
  lastExamDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'last_exam_date' },
  bestListeningScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'best_listening_score' },
  bestReadingScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'best_reading_score' },
  bestSpeakingScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'best_speaking_score' },
  bestWritingScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'best_writing_score' },
  bestCefr: { type: DataTypes.STRING(10), allowNull: true, field: 'best_cefr' },
  isB2plus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_b2plus' },
  totalCourseHours: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'total_course_hours' },
  totalActivityHours: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'total_activity_hours' },
  totalResourceHours: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'total_resource_hours' },
  preExamCourseHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'pre_exam_course_hours' },
  preExamActivityHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'pre_exam_activity_hours' },
  postExamCourseHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'post_exam_course_hours' },
  postExamActivityHours: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'post_exam_activity_hours' },
  exposureLevel: { type: DataTypes.STRING(20), allowNull: true, field: 'exposure_level' },
  hasValidExam: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_valid_exam' },
  hasRegisteredNoScore: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'has_registered_no_score' },
  excludeFlagSummary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'exclude_flag_summary' },
  reasonCodesSummary: { type: DataTypes.STRING(500), allowNull: true, field: 'reason_codes_summary' },
  snapshotVersion: { type: DataTypes.STRING(120), allowNull: true, field: 'snapshot_version' },
  ruleVersion: { type: DataTypes.STRING(30), allowNull: true, field: 'rule_version' },
  derivedAt: { type: DataTypes.DATE, allowNull: true, field: 'derived_at' },
}, {
  tableName: 'lj_analytic_students',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LjAnalyticStudent;
