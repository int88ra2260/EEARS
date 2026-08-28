'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LjStudentEvent = sequelize.define('LjStudentEvent', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  eventType: {
    type: DataTypes.ENUM('baseline_score', 'exam_event', 'course_event', 'activity_event', 'micro_learning_event'),
    allowNull: false,
    field: 'event_type',
  },
  eventDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'event_date' },
  academicYear: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, field: 'academic_year' },
  academicTerm: { type: DataTypes.STRING(12), allowNull: true, field: 'academic_term' },
  semIndex: { type: DataTypes.SMALLINT, allowNull: true, field: 'sem_index' },
  sourceSystem: { type: DataTypes.STRING(40), allowNull: false, field: 'source_system' },
  sourceRecordId: { type: DataTypes.STRING(80), allowNull: false, field: 'source_record_id' },
  status: {
    type: DataTypes.ENUM('valid', 'registered_no_score', 'void', 'excluded'),
    allowNull: false,
    defaultValue: 'valid',
  },
  excludeFlag: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'exclude_flag' },
  reasonCode: { type: DataTypes.STRING(40), allowNull: true, field: 'reason_code' },
  timing: { type: DataTypes.STRING(20), allowNull: true },
  instrument: { type: DataTypes.STRING(40), allowNull: true },
  skill: { type: DataTypes.STRING(20), allowNull: true },
  rawScore: { type: DataTypes.DECIMAL(10, 2), allowNull: true, field: 'raw_score' },
  cefrLevel: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_level' },
  hours: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  title: { type: DataTypes.STRING(200), allowNull: true },
  subtitle: { type: DataTypes.STRING(200), allowNull: true },
  ruleVersion: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'lj-analytics-2026-v1', field: 'rule_version' },
  rawPayload: { type: DataTypes.JSON, allowNull: true, field: 'raw_payload' },
}, {
  tableName: 'lj_student_events',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LjStudentEvent;
