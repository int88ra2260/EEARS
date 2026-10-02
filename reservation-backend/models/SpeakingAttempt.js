'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingAttempt = sequelize.define('SpeakingAttempt', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  attemptUid: { type: DataTypes.STRING(64), allowNull: false, field: 'attempt_uid' },
  taskId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'task_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: true, field: 'student_id' },
  clientSessionId: { type: DataTypes.STRING(64), allowNull: false, field: 'client_session_id' },
  submittedAt: { type: DataTypes.DATE, allowNull: false, field: 'submitted_at' },
  audioPath: { type: DataTypes.STRING(255), allowNull: false, field: 'audio_path' },
  audioMimeType: { type: DataTypes.STRING(80), allowNull: true, field: 'audio_mime_type' },
  audioSizeBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'audio_size_bytes' },
  durationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'duration_ms' },
  transcript: { type: DataTypes.TEXT, allowNull: true },
  features: { type: DataTypes.JSON, allowNull: true },
  automatedScores: { type: DataTypes.JSON, allowNull: true, field: 'automated_scores' },
  analysisVersion: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'v0', field: 'analysis_version' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'submitted' },
}, {
  tableName: 'speaking_attempts',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingAttempt;
