const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningJourneyOperationRun = sequelize.define('LearningJourneyOperationRun', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  operationType: { type: DataTypes.STRING(64), allowNull: false, field: 'operation_type' },
  semesterId: { type: DataTypes.STRING(20), allowNull: true, field: 'semester_id' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'running' },
  requestId: { type: DataTypes.STRING(64), allowNull: true, field: 'request_id' },
  executedByUserId: { type: DataTypes.STRING(64), allowNull: true, field: 'executed_by_user_id' },
  executedByUsername: { type: DataTypes.STRING(255), allowNull: true, field: 'executed_by_username' },
  startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
  finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
  durationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'duration_ms' },
  source: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'api' },
  dryRun: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'dry_run' },
  confirm: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  beforeSummary: { type: DataTypes.JSON, allowNull: true, field: 'before_summary' },
  afterSummary: { type: DataTypes.JSON, allowNull: true, field: 'after_summary' },
  diffSummary: { type: DataTypes.JSON, allowNull: true, field: 'diff_summary' },
  resultSummary: { type: DataTypes.JSON, allowNull: true, field: 'result_summary' },
  warnings: { type: DataTypes.JSON, allowNull: true },
  errorCode: { type: DataTypes.STRING(80), allowNull: true, field: 'error_code' },
  errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
  archivedAt: { type: DataTypes.DATE, allowNull: true, field: 'archived_at' },
  archivedByUserId: { type: DataTypes.STRING(64), allowNull: true, field: 'archived_by_user_id' },
  archivedByUsername: { type: DataTypes.STRING(255), allowNull: true, field: 'archived_by_username' },
  archiveReason: { type: DataTypes.TEXT, allowNull: true, field: 'archive_reason' },
  cleanupRequestId: { type: DataTypes.STRING(64), allowNull: true, field: 'cleanup_request_id' }
}, {
  tableName: 'learning_journey_operation_runs',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['semester_id'], name: 'idx_lj_operation_runs_semester' },
    { fields: ['operation_type'], name: 'idx_lj_operation_runs_type' },
    { fields: ['status'], name: 'idx_lj_operation_runs_status' },
    { fields: ['request_id'], name: 'idx_lj_operation_runs_request' },
    { fields: ['started_at'], name: 'idx_lj_operation_runs_started' },
    { fields: ['executed_by_user_id'], name: 'idx_lj_operation_runs_user' },
    { fields: ['archived_at'], name: 'idx_lj_operation_runs_archived_at' },
    { fields: ['cleanup_request_id'], name: 'idx_lj_operation_runs_cleanup_request' },
    { fields: ['archived_by_user_id'], name: 'idx_lj_operation_runs_archived_by' }
  ]
});

module.exports = LearningJourneyOperationRun;
