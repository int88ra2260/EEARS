'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtTaskTemplateItem = sequelize.define(
  'EtTaskTemplateItem',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    templateId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'template_id' },
    code: { type: DataTypes.STRING(30), allowNull: false },
    label: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    bandScope: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ALL', field: 'band_scope' },
    sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sort_order' },
    isRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_required' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  },
  {
    tableName: 'et_task_template_items',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtTaskTemplateItem;
