const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtExamAttempt = sequelize.define('EtExamAttempt', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  studentId: { type: DataTypes.STRING(50), allowNull: false },
  examType: { type: DataTypes.STRING(50), allowNull: true },
  examDate: { type: DataTypes.DATEONLY, allowNull: true },
  sourceType: { type: DataTypes.STRING(30), allowNull: true },
  sourceBatchId: { type: DataTypes.STRING(50), allowNull: true },
  rawPayload: { type: DataTypes.JSON, allowNull: true },
  createdBy: { type: DataTypes.STRING(50), allowNull: true },
  updatedBy: { type: DataTypes.STRING(50), allowNull: true },
  testType: { type: DataTypes.STRING(50), allowNull: true },
  testDate: { type: DataTypes.DATEONLY, allowNull: true },
  source: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'manual_import'
  },
  importBatchId: { type: DataTypes.STRING(50), allowNull: true },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'valid'
  },
  replacedByAttemptId: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'et_exam_attempts',
  timestamps: true,
  indexes: [
    { fields: ['studentId', 'testType', 'testDate'], name: 'uk_et_attempts_student_type_date', unique: true },
    { fields: ['importBatchId'], name: 'idx_et_attempts_batch' },
    { fields: ['status'], name: 'idx_et_attempts_status' }
  ]
});

module.exports = EtExamAttempt;
