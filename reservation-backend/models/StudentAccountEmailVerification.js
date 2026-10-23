const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentAccountEmailVerification = sequelize.define('StudentAccountEmailVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  codeHash: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  attemptCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  consumedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastSentAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'student_account_email_verifications',
  timestamps: true,
});

module.exports = StudentAccountEmailVerification;
