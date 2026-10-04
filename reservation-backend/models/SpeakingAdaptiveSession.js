'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingAdaptiveSession = sequelize.define('SpeakingAdaptiveSession', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  sessionUid: { type: DataTypes.STRING(64), allowNull: false, field: 'session_uid' },
  clientSessionId: { type: DataTypes.STRING(64), allowNull: false, field: 'client_session_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: true, field: 'student_id' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'active' },
  startedAt: { type: DataTypes.DATE, allowNull: false, field: 'started_at' },
  completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  initialLevel: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'B1', field: 'initial_level' },
  currentLevel: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'B1', field: 'current_level' },
  currentAbility: { type: DataTypes.FLOAT, allowNull: true, field: 'current_ability' },
  standardError: { type: DataTypes.FLOAT, allowNull: true, field: 'standard_error' },
  minTasks: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 4, field: 'min_tasks' },
  maxTasks: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 8, field: 'max_tasks' },
  completedTaskKeys: { type: DataTypes.JSON, allowNull: true, field: 'completed_task_keys' },
  constructCoverage: { type: DataTypes.JSON, allowNull: true, field: 'construct_coverage' },
  taskTypeCoverage: { type: DataTypes.JSON, allowNull: true, field: 'task_type_coverage' },
  path: { type: DataTypes.JSON, allowNull: true },
  decisionLog: { type: DataTypes.JSON, allowNull: true, field: 'decision_log' },
  resultSummary: { type: DataTypes.JSON, allowNull: true, field: 'result_summary' },
  stopReason: { type: DataTypes.STRING(120), allowNull: true, field: 'stop_reason' },
}, {
  tableName: 'speaking_adaptive_sessions',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingAdaptiveSession;
