const { DataTypes } = require('sequelize');
const sequelize = require('../db');

/**
 * 英檢註冊比對用：學名單上傳批次資訊（metadata）
 * 僅保存最新批次所對應的內容預覽；實際比對資料放在對應 entries 表。
 */
const EnglishTestStudentIdCardRosterUpload = sequelize.define(
  'EnglishTestStudentIdCardRosterUpload',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fileNameOriginal: { type: DataTypes.STRING(260), allowNull: false },
    storedFileUrl: { type: DataTypes.STRING(500), allowNull: true },
    rowCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    validCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    conflictCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: 'english_test_student_idcard_roster_uploads',
    timestamps: true,
  }
);

module.exports = EnglishTestStudentIdCardRosterUpload;

