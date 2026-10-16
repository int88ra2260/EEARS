'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LjTrackingCohort = sequelize.define('LjTrackingCohort', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING(80), allowNull: false },
  filtersJson: { type: DataTypes.JSON, allowNull: false, field: 'filters_json' },
  snapshotVersion: { type: DataTypes.STRING(120), allowNull: true, field: 'snapshot_version' },
  memberCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'member_count' },
  sourceTotal: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'source_total' },
  truncated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: true, field: 'created_by' },
  createdByName: { type: DataTypes.STRING(100), allowNull: true, field: 'created_by_name' },
}, {
  tableName: 'lj_tracking_cohorts',
  underscored: true,
});

module.exports = LjTrackingCohort;
