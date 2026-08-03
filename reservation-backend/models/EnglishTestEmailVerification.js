const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestEmailVerification = sequelize.define('EnglishTestEmailVerification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '正規化後的 email（小寫）',
  },
  studentId: {
    type: DataTypes.STRING(50),
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
  tableName: 'english_test_email_verifications',
  timestamps: true,
});

module.exports = EnglishTestEmailVerification;
