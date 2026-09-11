// models/Reservation.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Reservation = sequelize.define('Reservation', {
  // 主鍵 id 自動
  studentId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  studentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  studentEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  // 新增簽到狀態欄位
  checkinStatus: {
    type: DataTypes.ENUM('未簽到', '已簽到', '已登記違規'),
    defaultValue: '未簽到',
    allowNull: false
  },
  checkinTime: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '簽到時間'
  },
  // 新增組別欄位
  group: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '學生分組'
  },
  // 新增取消預約驗證碼欄位
  cancellationCode: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: '取消預約驗證碼'
  },
  countsTowardPassport: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'counts_toward_passport',
    comment: '學生聲明此預約要累計英語實踐歷程護照點數（與課堂加分擇一）',
  },
  passportPointsStatus: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'passport_points_status',
    comment: 'null|pending|granted|blocked_limit|failed',
  },
  passportSubmissionId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'passport_submission_id',
    comment: '對應 english_learning_submissions.id',
  },
}, {
  timestamps: false,
  tableName: 'reservations'  // 明確指定表名為 reservations（複數），確保使用正確的資料表
});

module.exports = Reservation;
