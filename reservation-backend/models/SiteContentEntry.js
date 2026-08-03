const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SiteContentEntry = sequelize.define(
  'SiteContentEntry',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entryType: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'text',
    },
    section: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    contentKey: {
      type: DataTypes.STRING(160),
      allowNull: true,
      unique: true,
    },
    label: {
      type: DataTypes.STRING(200),
      allowNull: false,
      defaultValue: '',
    },
    valueZh: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    valueEn: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    bodyZh: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    bodyEn: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    extension: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    tableName: 'SiteContentEntries',
    timestamps: true,
  }
);

module.exports = SiteContentEntry;
