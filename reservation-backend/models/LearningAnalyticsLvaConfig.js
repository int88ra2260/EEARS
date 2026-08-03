'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningAnalyticsLvaConfig = sequelize.define('LearningAnalyticsLvaConfig', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, defaultValue: 1 },
  configJson: { type: DataTypes.JSON, allowNull: false, defaultValue: {}, field: 'config_json' },
  updatedBy: { type: DataTypes.STRING(80), allowNull: true, field: 'updated_by' },
}, {
  tableName: 'learning_analytics_lva_config',
  timestamps: true,
  underscored: true,
});

module.exports = LearningAnalyticsLvaConfig;
