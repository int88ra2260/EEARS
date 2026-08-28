'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningTraceEvent = sequelize.define('LearningTraceEvent', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  traceId: { type: DataTypes.STRING(64), allowNull: false, field: 'trace_id' },
  gameId: { type: DataTypes.STRING(40), allowNull: false, field: 'game_id' },
  eventType: {
    type: DataTypes.ENUM(
      'session_start',
      'session_complete',
      'funnel_impression',
      'funnel_click',
      'funnel_book_attempt',
    ),
    allowNull: false,
    field: 'event_type',
  },
  clientSessionId: { type: DataTypes.STRING(64), allowNull: false, field: 'client_session_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: true, field: 'student_id' },
  occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
  durationMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'duration_ms' },
  score: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
  accuracy: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
  cefrLevel: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_level' },
  skillTags: { type: DataTypes.JSON, allowNull: true, field: 'skill_tags' },
  payload: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'learning_trace_events',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LearningTraceEvent;
