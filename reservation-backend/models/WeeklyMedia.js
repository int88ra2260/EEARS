const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const WeeklyMedia = sequelize.define(
  'WeeklyMedia',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    storedName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    mimeType: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    sizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    urlPath: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    alt: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'WeeklyMedia',
    timestamps: true,
  }
);

module.exports = WeeklyMedia;
