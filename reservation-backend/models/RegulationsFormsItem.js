const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const RegulationsFormsItem = sequelize.define(
  'RegulationsFormsItem',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    groupId: { type: DataTypes.INTEGER, allowNull: false },

    titleZh: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    titleEn: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    fileUrl: { type: DataTypes.STRING(900), allowNull: false },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'RegulationsFormsItems',
    timestamps: true,
  },
);

module.exports = RegulationsFormsItem;

