const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtSemester = sequelize.define('EtSemester', {
  id: {
    type: DataTypes.STRING(20),
    primaryKey: true,
    comment: '學期 ID，如 114-1'
  },
  code: { type: DataTypes.STRING(20), allowNull: true },
  name: { type: DataTypes.STRING(100), allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  snapshotDate: { type: DataTypes.DATEONLY, allowNull: true, comment: '名冊/統計鎖定日' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'et_semesters',
  timestamps: true
});

module.exports = EtSemester;
