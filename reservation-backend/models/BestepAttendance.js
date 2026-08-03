// models/BestepAttendance.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const BestepAttendance = sequelize.define('BestepAttendance', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  studentId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: '學號'
  },
  semester: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: '學期（如 114-1）'
  },
  examType: {
    type: DataTypes.ENUM('L', 'R', 'S', 'W', 'LR', 'SW'),
    allowNull: false,
    comment: '考試類型：L/R/S/W 單項或 LR/SW 組合'
  },
  examDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: '考試日期'
  },
  attended: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否出席'
  },
  absentReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '缺席原因'
  },
  importedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '匯入時間'
  },
  sourceFile: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '來源檔案名稱'
  },
  importBatchId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '匯入批次 ID，供匯入紀錄中心回滾'
  }
}, {
  tableName: 'bestep_attendance',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['studentId', 'semester', 'examType'],
      name: 'uk_student_semester_type'
    },
    {
      fields: ['examDate'],
      name: 'idx_examDate'
    },
    {
      fields: ['semester', 'examType'],
      name: 'idx_semester_type'
    },
    {
      fields: ['studentId'],
      name: 'idx_studentId'
    },
    {
      fields: ['importBatchId'],
      name: 'idx_bestep_attendance_import_batch'
    }
  ]
});

module.exports = BestepAttendance;
