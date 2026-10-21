const { DataTypes } = require('sequelize');
const sequelize = require('../db');

/**
 * 學生登入帳號。與後台 teachers 分開。
 * 本地密碼存在 passwordHash；未來校園單一入口只寫 ssoProvider / ssoSubject。
 */
const StudentAccount = sequelize.define('StudentAccount', {
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
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
  },
  ssoProvider: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },
  ssoSubject: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'student_accounts',
  indexes: [
    { unique: true, fields: ['studentId'], name: 'student_accounts_student_id_unique' },
    { unique: true, fields: ['email'], name: 'student_accounts_email_unique' },
    { unique: true, fields: ['ssoProvider', 'ssoSubject'], name: 'student_accounts_sso_unique' },
  ],
});

module.exports = StudentAccount;
