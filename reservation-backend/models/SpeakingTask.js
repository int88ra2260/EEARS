'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingTask = sequelize.define('SpeakingTask', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  taskKey: { type: DataTypes.STRING(80), allowNull: false, field: 'task_key' },
  level: { type: DataTypes.STRING(10), allowNull: false },
  taskType: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'read_aloud', field: 'task_type' },
  title: { type: DataTypes.STRING(120), allowNull: false },
  prompt: { type: DataTypes.TEXT, allowNull: false },
  targetText: { type: DataTypes.TEXT, allowNull: false, field: 'target_text' },
  estimatedSeconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'estimated_seconds' },
  targetWords: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'target_words' },
  focusTags: { type: DataTypes.JSON, allowNull: true, field: 'focus_tags' },
  constructTags: { type: DataTypes.JSON, allowNull: true, field: 'construct_tags' },
  discipline: { type: DataTypes.STRING(80), allowNull: true },
  communicationFunction: { type: DataTypes.STRING(80), allowNull: true, field: 'communication_function' },
  targetVocabulary: { type: DataTypes.JSON, allowNull: true, field: 'target_vocabulary' },
  teacherGoal: { type: DataTypes.TEXT, allowNull: true, field: 'teacher_goal' },
  linkedCourse: { type: DataTypes.STRING(120), allowNull: true, field: 'linked_course' },
  linkedActivity: { type: DataTypes.STRING(120), allowNull: true, field: 'linked_activity' },
  suggestedSupports: { type: DataTypes.JSON, allowNull: true, field: 'suggested_supports' },
  teacherNotes: { type: DataTypes.TEXT, allowNull: true, field: 'teacher_notes' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  version: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'v0' },
}, {
  tableName: 'speaking_tasks',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingTask;
