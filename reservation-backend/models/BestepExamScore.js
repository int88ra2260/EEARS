// models/BestepExamScore.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const BestepExamScore = sequelize.define('BestepExamScore', {
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
  examDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: '考試日期（可能 LR 和 SW 不同日期）'
  },
  listeningScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '聽力分數'
  },
  readingScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '閱讀分數'
  },
  speakingScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '口說分數'
  },
  writingScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '寫作分數'
  },
  listeningLevel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '聽力 CEFR 等級（如 A1, A2, B1, B2, C1, C2）'
  },
  readingLevel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '閱讀 CEFR 等級'
  },
  speakingLevel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '口說 CEFR 等級'
  },
  writingLevel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '寫作 CEFR 等級'
  },
  totalScore: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    comment: '總分（自動計算：聽+讀+說+寫）'
  },
  overallLevel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '整體 CEFR 等級（取最低項）'
  },
  passed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: '是否達標（各項都達 B2 以上）'
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
  tableName: 'bestep_exam_scores',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['studentId', 'semester'],
      name: 'uk_student_semester'
    },
    {
      fields: ['examDate'],
      name: 'idx_examDate'
    },
    {
      fields: ['semester'],
      name: 'idx_semester'
    },
    {
      fields: ['studentId'],
      name: 'idx_studentId'
    },
    {
      fields: ['semester', 'passed'],
      name: 'idx_passed'
    },
    {
      fields: ['importBatchId'],
      name: 'idx_bestep_exam_scores_import_batch'
    }
  ],
});

module.exports = BestepExamScore;
