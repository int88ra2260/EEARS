// models/EnglishTestRegistration.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestRegistration = sequelize.define('EnglishTestRegistration', {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  
  // 基本資料
  studentId: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '學號（與 semester 複合唯一，見 migration uk_student_semester）'
  },
  name: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '中文姓名'
  },
  idNumber: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '身分證字號'
  },
  
  // Q1-Q5: 基本聯絡資訊
  email: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    comment: '電子郵件'
  },
  studentNameZh: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '中文姓名'
  },
  lastNameEn: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '英文拼音姓'
  },
  firstNameEn: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '英文拼音名'
  },
  birthDate: { 
    type: DataTypes.DATEONLY, 
    allowNull: true,
    comment: '出生年月日（不報考時可為空）'
  },
  
  // Q6-Q10: 英語能力與培力資格
  examType: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '報考項目：LRSW(聽說讀寫), LR(聽讀), SW(說寫), NON(不報考)'
  },
  hasTakenBESTEP: { 
    type: DataTypes.STRING(10), 
    allowNull: true,
    defaultValue: '否',
    comment: '是否曾報考 BESTEP'
  },
  hasCEFRB2: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '是否曾取得 CEFR B2 以上成績'
  },
  passedExamTypes: { 
    type: DataTypes.JSON, 
    allowNull: true,
    comment: '已通過的測驗種類（陣列）'
  },
  passedExamOther: { 
    type: DataTypes.STRING(100), 
    allowNull: true,
    comment: '其他測驗種類'
  },
  b2CertificateFile: { 
    type: DataTypes.TEXT, 
    allowNull: true,
    comment: 'B2 成績證明檔案路徑（JSON 陣列字串，支援多檔案）'
  },
  b2SkillType: { 
    type: DataTypes.STRING(50), 
    allowNull: true,
    comment: '通過 B2 的項目（舊版，已棄用）'
  },
  // Q3: 各項成績（整合原 Q3 和 Q4）
  listeningExamType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '聽力測驗類別'
  },
  listeningScore: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '聽力成績'
  },
  readingExamType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '閱讀測驗類別'
  },
  readingScore: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '閱讀成績'
  },
  speakingExamType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '口說測驗類別'
  },
  speakingScore: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '口說成績'
  },
  writingExamType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '寫作測驗類別'
  },
  writingScore: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '寫作成績'
  },
  
  // Q11-Q18: 身分與學籍資料
  nationalId: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '身分證字號'
  },
  phone: { 
    type: DataTypes.STRING(20), 
    allowNull: false,
    comment: '行動電話'
  },
  postalCode: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '郵遞區號'
  },
  city: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '縣市'
  },
  district: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '行政區'
  },
  address: { 
    type: DataTypes.STRING(200), 
    allowNull: false,
    comment: '詳細地址'
  },
  degreeLevel: { 
    type: DataTypes.STRING(20), 
    allowNull: false,
    comment: '就讀身分'
  },
  grade: { 
    type: DataTypes.STRING(20), 
    allowNull: false,
    comment: '年級'
  },
  college: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '學院'
  },
  department: { 
    type: DataTypes.STRING(100), 
    allowNull: false,
    comment: '科系'
  },
  
  // Q19-Q23: 特殊身分與協助需求
  isLowIncome: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '是否為中低收入戶'
  },
  hasDisabilityCard: { 
    type: DataTypes.STRING(10), 
    allowNull: false,
    comment: '是否有身心障礙手冊'
  },
  disabilityTypes: { 
    type: DataTypes.JSON, 
    allowNull: true,
    comment: '身心障礙類別（陣列）'
  },
  disabilityCertFront: { 
    type: DataTypes.STRING(255), 
    allowNull: true,
    comment: '身心障礙證明正面檔案路徑'
  },
  disabilityCertBack: { 
    type: DataTypes.STRING(255), 
    allowNull: true,
    comment: '身心障礙證明反面檔案路徑'
  },
  examAssistanceOptions: { 
    type: DataTypes.JSON, 
    allowNull: true,
    comment: '需要的考試協助項目（陣列）'
  },
  examAssistanceOther: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '考試協助項目「其他」的文字說明'
  },
  
  // Q24-Q26: 照片與同意事項
  idPhoto: { 
    type: DataTypes.STRING(255), 
    allowNull: true,
    comment: '證件照檔案路徑（不報考時可為空）'
  },
  agreedToTerms: { 
    type: DataTypes.BOOLEAN, 
    allowNull: false,
    defaultValue: false,
    comment: '個資與報名規範同意'
  },
  infoSource: { 
    type: DataTypes.STRING(50), 
    allowNull: false,
    comment: '從何得知培力英檢'
  },
  extraAnswers: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '自訂／額外題答案 { [fieldKey]: value }（非報名主檔預設欄位）'
  },
  
  // 狀態欄位
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    comment: '報名狀態：pending(審核中), approved(已通過), revision(請修正), success(報名成功), failed(報名失敗)'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '備註'
  },
  rejectionReasons: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '拒絕原因（陣列，可複選）'
  },
  rejectionOther: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '拒絕原因「其他」的文字說明'
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '被標記為「已通過」的時間（用於排序報名成功的順序）'
  },
  successSequence: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '報名成功的順序編號（根據變為已通過的時間順序，可手動調整）'
  },
  semester: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '學期（如 114-1）'
  },

  // 培力英檢抵免審核（綁在報名紀錄上）
  exemption_review_status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '抵免審核狀態：pending/approved/rejected/revision'
  },
  exemption_verified_type: {
    type: DataTypes.STRING(10),
    allowNull: true,
    comment: '審核通過後之抵免項目：LRSW/LR/SW/NONE'
  },
  exemption_review_note: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '抵免審核備註'
  },
  exemption_reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '抵免審核時間'
  },
  exemption_reviewed_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '抵免審核者（帳號）'
  }
}, {
  tableName: 'english_test_registrations',
  timestamps: true,
  indexes: [
    {
      fields: ['semester'],
      name: 'idx_semester'
    },
    {
      unique: true,
      fields: ['studentId', 'semester'],
      name: 'uk_student_semester'
    }
  ]
});

module.exports = EnglishTestRegistration;
