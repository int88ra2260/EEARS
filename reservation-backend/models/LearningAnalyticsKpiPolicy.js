'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningAnalyticsKpiPolicy = sequelize.define('LearningAnalyticsKpiPolicy', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  policyKey: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    field: 'policy_key',
  },
  name: { type: DataTypes.STRING(160), allowNull: false },
  academicYear: { type: DataTypes.STRING(20), allowNull: true, field: 'academic_year' },
  description: { type: DataTypes.TEXT, allowNull: true },
  definitionJson: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
    field: 'definition_json',
  },
  isBuiltin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_builtin',
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_archived',
  },
  createdBy: { type: DataTypes.STRING(80), allowNull: true, field: 'created_by' },
  updatedBy: { type: DataTypes.STRING(80), allowNull: true, field: 'updated_by' },
}, {
  tableName: 'learning_analytics_kpi_policies',
  timestamps: true,
  underscored: true,
});

module.exports = LearningAnalyticsKpiPolicy;
