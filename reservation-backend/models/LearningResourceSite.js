const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningResourceSite = sequelize.define(
  'LearningResourceSite',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    titleZh: { type: DataTypes.STRING(200), allowNull: true },
    titleEn: { type: DataTypes.STRING(200), allowNull: true },
    introZh: { type: DataTypes.TEXT('long'), allowNull: true },
    introEn: { type: DataTypes.TEXT('long'), allowNull: true },
    tag: { type: DataTypes.STRING(80), allowNull: true },
    href: { type: DataTypes.STRING(600), allowNull: false },

    // 若維運端只想先改內容、暫不直接填入雙語文字，可用 translation key 當作 fallback
    titleKey: { type: DataTypes.STRING(160), allowNull: true },
    introKey: { type: DataTypes.STRING(160), allowNull: true },
    tagKey: { type: DataTypes.STRING(160), allowNull: true },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'LearningResourceSites',
    timestamps: true,
  },
);

module.exports = LearningResourceSite;

