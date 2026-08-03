'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LjAnalyticExam = sequelize.define('LjAnalyticExam', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  examEventId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'exam_event_id' },
  examDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'exam_date' },
  instrument: { type: DataTypes.STRING(40), allowNull: false },
  skill: { type: DataTypes.STRING(20), allowNull: false },
  rawScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'raw_score' },
  cefrLevel: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_level' },
  isB2plus: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_b2plus' },
  examSeq: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'exam_seq' },
  examRound: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'exam_round' },
  testPhase: { type: DataTypes.STRING(20), allowNull: true, field: 'test_phase' },
  sessionDateStart: { type: DataTypes.DATEONLY, allowNull: true, field: 'session_date_start' },
  sessionDateEnd: { type: DataTypes.DATEONLY, allowNull: true, field: 'session_date_end' },
  exposureWindowStart: { type: DataTypes.DATEONLY, allowNull: true, field: 'exposure_window_start' },
  timing: { type: DataTypes.STRING(20), allowNull: true },
  previousExamEventId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'previous_exam_event_id' },
  previousRawScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'previous_raw_score' },
  deltaRawScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'delta_raw_score' },
  improvedFlag: { type: DataTypes.BOOLEAN, allowNull: true, field: 'improved_flag' },
  retestFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'retest_flag' },
  courseHoursBeforeExam: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'course_hours_before_exam' },
  activityHoursBeforeExam: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'activity_hours_before_exam' },
  resourceHoursBeforeExam: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'resource_hours_before_exam' },
  courseCountBeforeExam: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'course_count_before_exam' },
  activityCountBeforeExam: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'activity_count_before_exam' },
  exposureBeforeExamFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'exposure_before_exam_flag' },
  registeredNoScoreFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'registered_no_score_flag' },
  excludeFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'exclude_flag' },
  reasonCode: { type: DataTypes.STRING(40), allowNull: true, field: 'reason_code' },
  status: { type: DataTypes.STRING(30), allowNull: true },
  snapshotVersion: { type: DataTypes.STRING(120), allowNull: true, field: 'snapshot_version' },
  ruleVersion: { type: DataTypes.STRING(30), allowNull: true, field: 'rule_version' },
  derivedAt: { type: DataTypes.DATE, allowNull: true, field: 'derived_at' },
}, {
  tableName: 'lj_analytic_exams',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LjAnalyticExam;
