'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningAnalyticsFilterReference = sequelize.define('LearningAnalyticsFilterReference', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  refType: { type: DataTypes.STRING(30), allowNull: false, field: 'ref_type' },
  value: { type: DataTypes.STRING(120), allowNull: false },
  label: { type: DataTypes.STRING(160), allowNull: true },
  sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sort_order' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  createdBy: { type: DataTypes.STRING(80), allowNull: true, field: 'created_by' },
}, {
  tableName: 'learning_analytics_filter_references',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LearningAnalyticsFilterReference;
