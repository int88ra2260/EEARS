// models/Event.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Event = sequelize.define('Event', {
  // 主鍵 id 會自動由 Sequelize 以 INT + AUTO_INCREMENT 建立
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.STRING,  // 可改用 DataTypes.DATEONLY，視需求
    allowNull: false
  },
  startTime: {
    type: DataTypes.STRING,  // 或 DataTypes.TIME
    allowNull: false
  },
  endTime: {
    type: DataTypes.STRING,
    allowNull: false
  },
  maxCapacity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  groupCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'group_count',
    comment: '分組數（English Table）',
  },
  perGroupCapacity: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'per_group_capacity',
    comment: '每組人數上限',
  },
  eventType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'English Table'
  },
  semesterId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true
  },
  customReservationRule: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '自定義活動類型的預約時間規則說明'
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '活動地點'
  },
  autoCheckCompleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: '是否已執行過活動結束檢查'
  },
  groupingMode: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'legacy_sequential',
    field: 'grouping_mode',
    comment: 'ET 分組模式：legacy_sequential | ability',
  }
}, {
  // 是否需要 timestamps (createdAt, updatedAt)
  timestamps: false,
  tableName: 'events'  // 明確指定表名為 events（複數），確保使用正確的資料表
});

module.exports = Event;
