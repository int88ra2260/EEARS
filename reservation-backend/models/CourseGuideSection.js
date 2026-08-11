const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CourseGuideSection = sequelize.define(
  'CourseGuideSection',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sectionKey: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    titleZh: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    titleEn: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    introZh: { type: DataTypes.TEXT('long'), allowNull: true },
    introEn: { type: DataTypes.TEXT('long'), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'CourseGuideSections',
    timestamps: true,
  },
);

module.exports = CourseGuideSection;
