// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  studentId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true  // 學號通常唯一
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 是否在黑名單
  isBlacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  // 若在黑名單，何時解鎖
  blacklistUntil: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // 違規次數 (以當學期 BlackListRecord 重算；跨學期歸零)
  violationCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
}, {
  tableName: 'Users',
  timestamps: false
});

module.exports = User;
