const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentFeedbackEvent = sequelize.define('StudentFeedbackEvent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  feedbackId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  eventType: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  visibility: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'staff',
  },
  actorType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  actorTeacherId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  actorStudentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  beforeValue: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  afterValue: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  requestId: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'student_feedback_events',
  updatedAt: false,
});

module.exports = StudentFeedbackEvent;
