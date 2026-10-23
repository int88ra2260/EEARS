const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentAccountReview = sequelize.define('StudentAccountReview', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'student_account_reviews',
  indexes: [
    { fields: ['status', 'createdAt'], name: 'idx_student_account_reviews_status_created' },
    { fields: ['studentId'], name: 'idx_student_account_reviews_student_id' },
    { fields: ['email'], name: 'idx_student_account_reviews_email' },
  ],
});

module.exports = StudentAccountReview;
