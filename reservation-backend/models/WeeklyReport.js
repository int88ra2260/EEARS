const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const WeeklyReport = sequelize.define(
  'WeeklyReport',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    issueKey: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    headline: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    editorial: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    learningTip: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    wordBridgeLevel: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: 'A2',
    },
    wordBridgeThemeIds: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    weekStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    weekEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    blocks: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    blocksVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'WeeklyReports',
    timestamps: true,
  }
);

module.exports = WeeklyReport;
