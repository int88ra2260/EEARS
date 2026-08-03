'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

/**
 * 培力英檢報名表單 schema（單列 current；可保留歷史版本列）。
 * schemaJson 結構見 data/englishTestFormDefaultSchema.js
 */
const EnglishTestFormSchema = sequelize.define(
  'EnglishTestFormSchema',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      comment: 'schema 版本號（每次儲存遞增）',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'published',
      comment: 'draft | published',
    },
    schemaJson: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: '表單 sections + questions + departmentOptions',
    },
    changeSummary: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '最後更新的 User.id',
    },
  },
  {
    tableName: 'english_test_form_schemas',
    timestamps: true,
  }
);

module.exports = EnglishTestFormSchema;
