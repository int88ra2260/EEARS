'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtLeaderCheckinToken = sequelize.define(
  'EtLeaderCheckinToken',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, field: 'token_hash' },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
    rotatedAt: { type: DataTypes.DATE, allowNull: false, field: 'rotated_at' },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  },
  {
    tableName: 'et_leader_checkin_tokens',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtLeaderCheckinToken;
