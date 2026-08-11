const { DataTypes } = require('sequelize');
const sequelize = require('../db');

/**
 * 英檢註冊比對用：最新學名單中「學號 → 身分證字號」對應。
 *
 * 規則：
 * - 每次上傳新 Excel 會覆蓋整份 entries（只保留最新一份）。
 * - studentId 為主鍵，確保同一學生只會有一筆有效對應。
 */
const EnglishTestStudentIdCardRosterEntry = sequelize.define(
  'EnglishTestStudentIdCardRosterEntry',
  {
    studentId: { type: DataTypes.STRING(50), primaryKey: true },
    idNumber: { type: DataTypes.STRING(10), allowNull: false },
    nameZh: { type: DataTypes.STRING(50), allowNull: true },
  },
  {
    tableName: 'english_test_student_idcard_roster_entries',
    timestamps: true,
    createdAt: true,
    updatedAt: true,
  }
);

module.exports = EnglishTestStudentIdCardRosterEntry;

