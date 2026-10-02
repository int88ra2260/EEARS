'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingHumanRating = sequelize.define('SpeakingHumanRating', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  attemptId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'attempt_id' },
  raterUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'rater_user_id' },
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
  rubricVersion: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'v0', field: 'rubric_version' },
}, {
  tableName: 'speaking_human_ratings',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingHumanRating;
