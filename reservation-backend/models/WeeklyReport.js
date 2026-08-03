const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const WeeklyReport = sequelize.define('WeeklyReport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '年份',
  },
  week: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '週數',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '週報標題',
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'start_date',
    comment: '週報起始日期',
  },
  endDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'end_date',
    comment: '週報結束日期',
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: '週報內容 (Markdown)',
  },
  status: {
    type: DataTypes.ENUM('draft', 'pending', 'published'),
    defaultValue: 'draft',
    allowNull: false,
    comment: '狀態：草稿/待審核/已發布',
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'created_by',
    comment: '建立者',
  },
  updatedBy: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'updated_by',
    comment: '更新者',
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'published_at',
    comment: '發布時間',
  },
}, {
  tableName: 'weekly_reports',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['year', 'week'],
      name: 'idx_weekly_reports_year_week',
    },
    {
      fields: ['status'],
      name: 'idx_weekly_reports_status',
    },
  ],
});

module.exports = WeeklyReport;
