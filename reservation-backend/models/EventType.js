'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EventType = sequelize.define(
  'EventType',
  {
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
      comment: '穩定鍵（存於 events.eventType）',
    },
    displayName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'display_name',
    },
    abbreviation: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: '',
    },
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
      comment: 'URL ?type= slug',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: 'sort_order',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    legacyAliases: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'legacy_aliases',
      comment: '舊顯示名／簡稱，供相容解析',
    },
    openRule: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'open_rule',
      comment: '預約開放規則 JSON',
    },
    cutoffHours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 2,
      field: 'cutoff_hours',
      comment: '預約與公開取消共用截止（活動開始前小時數）',
    },
    capacityMode: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'simple',
      field: 'capacity_mode',
      comment: 'simple | grouped',
    },
    defaultGroupCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'default_group_count',
    },
    defaultPerGroupCapacity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'default_per_group_capacity',
    },
    maxCapacityCap: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'max_capacity_cap',
    },
    maxGroupCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'max_group_count',
    },
    maxPerGroup: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'max_per_group',
    },
    surveyGateEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'survey_gate_enabled',
    },
  },
  {
    tableName: 'event_types',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EventType;
