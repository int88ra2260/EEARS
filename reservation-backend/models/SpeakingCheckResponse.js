'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingCheckResponse = sequelize.define('SpeakingCheckResponse', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  participantId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'participant_id' },
  itemId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'item_id' },
  transcript: { type: DataTypes.TEXT, allowNull: true },
  durationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'duration_ms' },
  fluencyPercent: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'fluency_percent' },
  completionPercent: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'completion_percent' },
  pronunciationPercent: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'pronunciation_percent' },
  wordResults: { type: DataTypes.JSON, allowNull: true, field: 'word_results' },
  clientFeatures: { type: DataTypes.JSON, allowNull: true, field: 'client_features' },
  audioPath: { type: DataTypes.STRING(255), allowNull: true, field: 'audio_path' },
  audioMime: { type: DataTypes.STRING(80), allowNull: true, field: 'audio_mime' },
  submittedAt: { type: DataTypes.DATE, allowNull: false, field: 'submitted_at' },
}, {
  tableName: 'speaking_check_responses',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingCheckResponse;
