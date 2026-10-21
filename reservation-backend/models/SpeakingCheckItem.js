'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SpeakingCheckItem = sequelize.define('SpeakingCheckItem', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  setId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'set_id' },
  position: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  title: { type: DataTypes.STRING(40), allowNull: false },
  targetText: { type: DataTypes.TEXT, allowNull: false, field: 'target_text' },
}, {
  tableName: 'speaking_check_items',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SpeakingCheckItem;
