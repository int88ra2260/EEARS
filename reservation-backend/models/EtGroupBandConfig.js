'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtGroupBandConfig = sequelize.define(
  'EtGroupBandConfig',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    semesterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'semester_id' },
    code: { type: DataTypes.STRING(20), allowNull: false },
    label: { type: DataTypes.STRING(80), allowNull: false },
    gseMin: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'gse_min' },
    gseMax: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'gse_max' },
    cefrMin: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_min' },
    cefrMax: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_max' },
    maxPerTable: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 12, field: 'max_per_table' },
    tableCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, field: 'table_count' },
    sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sort_order' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  },
  {
    tableName: 'et_group_band_configs',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtGroupBandConfig;
