const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentFeedbackRead = sequelize.define('StudentFeedbackRead', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  feedbackId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  readerType: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },
  readerKey: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  lastReadAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'student_feedback_reads',
  indexes: [
    {
      unique: true,
      fields: ['feedbackId', 'readerType', 'readerKey'],
      name: 'uq_student_feedback_reads_reader',
    },
    { fields: ['readerType', 'readerKey'], name: 'idx_student_feedback_reads_reader' },
  ],
});

module.exports = StudentFeedbackRead;
