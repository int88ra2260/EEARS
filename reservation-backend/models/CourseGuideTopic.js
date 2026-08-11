const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const CourseGuideTopic = sequelize.define(
  'CourseGuideTopic',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sectionId: { type: DataTypes.INTEGER, allowNull: false },
    topicKey: { type: DataTypes.STRING(64), allowNull: false },
    titleZh: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    titleEn: { type: DataTypes.STRING(250), allowNull: false, defaultValue: '' },
    defaultOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    contentJson: { type: DataTypes.TEXT('long'), allowNull: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'CourseGuideTopics',
    timestamps: true,
  },
);

module.exports = CourseGuideTopic;
