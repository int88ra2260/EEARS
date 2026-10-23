const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const StudentAccountPasswordReset = sequelize.define('StudentAccountPasswordReset', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  studentAccountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
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
  tableName: 'student_account_password_resets',
  timestamps: true,
});

module.exports = StudentAccountPasswordReset;
