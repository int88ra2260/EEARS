'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingCheckSet = sequelize.define('SpeakingCheckSet', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  hostId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'host_id' },
  title: { type: DataTypes.STRING(80), allowNull: false },
  joinCode: { type: DataTypes.STRING(6), allowNull: true, field: 'join_code' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
  publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
}, {
  tableName: 'speaking_check_sets',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingCheckSet;
