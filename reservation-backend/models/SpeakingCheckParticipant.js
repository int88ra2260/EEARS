'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingCheckParticipant = sequelize.define('SpeakingCheckParticipant', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  participantUid: { type: DataTypes.STRING(36), allowNull: false, field: 'participant_uid' },
  setId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'set_id' },
  displayName: { type: DataTypes.STRING(30), allowNull: false, field: 'display_name' },
  clientSessionId: { type: DataTypes.STRING(64), allowNull: false, field: 'client_session_id' },
  joinedAt: { type: DataTypes.DATE, allowNull: false, field: 'joined_at' },
}, {
  tableName: 'speaking_check_participants',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingCheckParticipant;
