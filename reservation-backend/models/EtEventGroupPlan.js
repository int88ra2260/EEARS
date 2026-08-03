'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtEventGroupPlan = sequelize.define(
  'EtEventGroupPlan',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    algorithmVersion: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'v1', field: 'algorithm_version' },
    generatedAt: { type: DataTypes.DATE, allowNull: true, field: 'generated_at' },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
    publishedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'published_by' },
    abilityGroupSlots: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'ability_group_slots',
      comment: '啟用能力分組的組別編號（1-based）',
    },
    groupingLayout: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'physical_slots',
      field: 'grouping_layout',
      comment: 'physical_slots | band_tables',
    },
  },
  {
    tableName: 'et_event_group_plans',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtEventGroupPlan;
