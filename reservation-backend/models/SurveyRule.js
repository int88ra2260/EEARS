const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SurveyRule = sequelize.define(
  'SurveyRule',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    surveyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
    semesterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    activityType: { type: DataTypes.STRING(120), allowNull: true },
    surveyVersionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    isRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    triggerMode: { type: DataTypes.STRING(40), allowNull: true },
    fillScope: { type: DataTypes.STRING(40), allowNull: true },
    appliesToAllEvents: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    eventId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    startAt: { type: DataTypes.DATE, allowNull: true },
    endAt: { type: DataTypes.DATE, allowNull: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    startDate: { type: DataTypes.DATE, allowNull: true },
    endDate: { type: DataTypes.DATE, allowNull: true },
    gatingMode: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'reservation' },
    retakePolicy: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'once_per_semester' },
    retakeScope: { type: DataTypes.STRING(40), allowNull: true },
    semesterKey: { type: DataTypes.STRING(64), allowNull: true },
    targetEventType: { type: DataTypes.STRING(120), allowNull: true },
    targetEventId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    collectStudentId: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    collectStudentName: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    collectStudentEmail: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    allowEditAfterSubmit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isAnonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    settingsJson: { type: DataTypes.JSON, allowNull: true },
    updatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  {
    tableName: 'survey_rules',
    timestamps: true,
  }
);

module.exports = SurveyRule;
