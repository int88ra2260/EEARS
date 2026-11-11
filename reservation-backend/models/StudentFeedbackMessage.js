const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentFeedbackMessage = sequelize.define('StudentFeedbackMessage', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  feedbackId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  authorType: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  visibility: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  teacherId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  emailStatus: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
}, {
  tableName: 'student_feedback_messages',
  indexes: [
    { fields: ['feedbackId', 'createdAt'], name: 'idx_student_feedback_messages_case' },
    { fields: ['studentId', 'createdAt'], name: 'idx_student_feedback_messages_student' },
  ],
});

module.exports = StudentFeedbackMessage;
