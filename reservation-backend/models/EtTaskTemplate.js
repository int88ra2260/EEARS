'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtTaskTemplate = sequelize.define(
  'EtTaskTemplate',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    semesterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'semester_id' },
    name: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'ET 預設任務模板' },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_default' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  },
  {
    tableName: 'et_task_templates',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtTaskTemplate;
