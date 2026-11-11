const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentFeedback = sequelize.define('StudentFeedback', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  studentName: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  kind: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  emailStatus: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'open',
  },
  replyRequested: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  assignedTeacherId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'student_feedback',
  indexes: [
    { fields: ['studentId', 'createdAt'], name: 'idx_student_feedback_student_created' },
    { fields: ['createdAt'], name: 'idx_student_feedback_created' },
    { fields: ['kind', 'createdAt'], name: 'idx_student_feedback_kind_created' },
    { fields: ['status', 'createdAt'], name: 'idx_student_feedback_status_created' },
    { fields: ['assignedTeacherId'], name: 'idx_student_feedback_assignee' },
  ],
});

module.exports = StudentFeedback;
