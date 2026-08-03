const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ScrollWorldTestSegment = sequelize.define(
  'ScrollWorldTestSegment',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    sectionId: { type: DataTypes.STRING(32), allowNull: false, unique: true },

    labelZh: { type: DataTypes.STRING(200), allowNull: true },
    labelEn: { type: DataTypes.STRING(200), allowNull: true },

    titleZh: { type: DataTypes.STRING(400), allowNull: true },
    titleEn: { type: DataTypes.STRING(400), allowNull: true },
    bodyZh: { type: DataTypes.TEXT('long'), allowNull: true },
    bodyEn: { type: DataTypes.TEXT('long'), allowNull: true },

    primaryCtaLabelZh: { type: DataTypes.STRING(200), allowNull: true },
    primaryCtaLabelEn: { type: DataTypes.STRING(200), allowNull: true },
    primaryCtaHref: { type: DataTypes.STRING(900), allowNull: true },
    primaryCtaIsExternal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    // JSON array: [{ labelZh, labelEn, href, isExternal }]
    secondaryCtasJson: { type: DataTypes.TEXT('long'), allowNull: true },

    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'ScrollWorldTestSegments',
    timestamps: true,
  },
);

module.exports = ScrollWorldTestSegment;

