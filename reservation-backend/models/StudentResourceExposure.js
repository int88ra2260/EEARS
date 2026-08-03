'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentResourceExposure = sequelize.define('StudentResourceExposure', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  modelRunId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'model_run_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  sourceEventId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'source_event_id' },
  resourceType: { type: DataTypes.STRING(60), allowNull: false, field: 'resource_type' },
  resourceId: { type: DataTypes.STRING(80), allowNull: true, field: 'resource_id' },
  participationDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'participation_date' },
  durationMinutes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'duration_minutes' },
  attendanceStatus: { type: DataTypes.STRING(40), allowNull: true, field: 'attendance_status' },
  attendanceQuality: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'attendance_quality' },
  skillExposurePayload: { type: DataTypes.JSON, allowNull: true, field: 'skill_exposure_payload' },
  timeDecayWeight: { type: DataTypes.DECIMAL(8, 4), allowNull: true, field: 'time_decay_weight' },
  validForTestId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'valid_for_test_id' },
  estimateType: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'descriptive', field: 'estimate_type' },
  causalClaimAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'causal_claim_allowed' },
}, {
  tableName: 'student_resource_exposures',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = StudentResourceExposure;
