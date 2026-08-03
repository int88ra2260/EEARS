const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const RegulationsFormsGroup = sequelize.define(
  'RegulationsFormsGroup',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    titleZh: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    titleEn: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'RegulationsFormsGroups',
    timestamps: true,
  },
);

module.exports = RegulationsFormsGroup;

