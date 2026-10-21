'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingHost = sequelize.define('SpeakingHost', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false, field: 'password_hash' },
  displayName: { type: DataTypes.STRING(40), allowNull: false, field: 'display_name' },
}, {
  tableName: 'speaking_hosts',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingHost;
