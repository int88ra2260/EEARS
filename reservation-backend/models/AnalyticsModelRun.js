'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const AnalyticsModelRun = sequelize.define('AnalyticsModelRun', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  modelName: { type: DataTypes.STRING(80), allowNull: false, field: 'model_name' },
  modelVersion: { type: DataTypes.STRING(80), allowNull: false, field: 'model_version' },
  contractVersion: { type: DataTypes.STRING(80), allowNull: false, field: 'contract_version' },
  snapshotVersion: { type: DataTypes.STRING(120), allowNull: true, field: 'snapshot_version' },
  semester: { type: DataTypes.STRING(20), allowNull: true },
  filtersPayload: { type: DataTypes.JSON, allowNull: true, field: 'filters_payload' },
  supportedFiltersPayload: { type: DataTypes.JSON, allowNull: true, field: 'supported_filters_payload' },
  includedStudentsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'included_students_count' },
  excludedStudentsCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'excluded_students_count' },
  missingDataSummary: { type: DataTypes.JSON, allowNull: true, field: 'missing_data_summary' },
  estimatePolicyPayload: { type: DataTypes.JSON, allowNull: true, field: 'estimate_policy_payload' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'completed' },
  startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
  finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
  createdBy: { type: DataTypes.STRING(80), allowNull: true, field: 'created_by' },
}, {
  tableName: 'analytics_model_runs',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = AnalyticsModelRun;
