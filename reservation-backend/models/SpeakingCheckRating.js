'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingCheckRating = sequelize.define('SpeakingCheckRating', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  responseId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'response_id' },
  hostId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_id' },
  fluency: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  pronunciationIntelligibility: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    field: 'pronunciation_intelligibility',
  },
  grammar: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  vocabulary: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true },
  taskAchievement: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true, field: 'task_achievement' },
  comments: { type: DataTypes.TEXT, allowNull: true },
  rubricVersion: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'speaking-check-v1',
    field: 'rubric_version',
  },
}, {
  tableName: 'speaking_check_ratings',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingCheckRating;
