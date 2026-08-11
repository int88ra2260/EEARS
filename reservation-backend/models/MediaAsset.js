const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const MediaAsset = sequelize.define(
  'MediaAsset',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING(120), allowNull: true, unique: true },
    url: { type: DataTypes.STRING(500), allowNull: false, unique: true },
    label: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    originalName: { type: DataTypes.STRING(250), allowNull: true },
    storedName: { type: DataTypes.STRING(250), allowNull: true },
    mime: { type: DataTypes.STRING(100), allowNull: true },
    source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'upload' },
    scope: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'general' },
    byteSize: { type: DataTypes.INTEGER, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    uploadedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'MediaAssets',
    timestamps: true,
  },
);

module.exports = MediaAsset;
