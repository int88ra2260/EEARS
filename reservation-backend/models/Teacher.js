// models/Teacher.js
const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Teacher = sequelize.define('Teacher', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '老師姓名'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    // unique: true 已移至 indexes 陣列中定義，避免重複創建索引
    comment: '老師電子郵件'
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    // unique: true 已移至 indexes 陣列中定義，避免重複創建索引
    comment: '老師帳號名稱'
  },
  studentId: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'studentId',
    comment: '學號（主要供 role=leader）',
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '密碼（加密）'
  },
  role: {
    type: DataTypes.ENUM('admin', 'worker', 'teacher', 'office_staff', 'leader'),
    allowNull: false,
    defaultValue: 'teacher',
    comment: '帳號角色'
  },
  teacherLevel: {
    type: DataTypes.ENUM('executive', 'et_manager', 'if_manager', 'jt_manager', 'regular'),
    allowNull: true,
    defaultValue: 'regular',
    comment: '老師層級：executive=執行長, et_manager=English Table負責人, if_manager=International Forum負責人, jt_manager=Job Talk負責人, regular=一般老師'
  },
  staffLevel: {
    type: DataTypes.ENUM('event_lead', 'curriculum_lead', 'bestep_lead', 'deputy_manager'),
    allowNull: true,
    comment: '行政職員職務：活動／課務／培力英檢／副理（僅 role=office_staff 有意義）'
  },
  mustResetPassword: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: '是否需首次登入或重設密碼'
  },
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最後變更密碼時間'
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '最後登入時間'
  },
  createdBy: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '建立此帳號的管理員'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: '帳號是否啟用'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '所屬系所'
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '聯絡電話'
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'per-user permission overrides（true=allow, false=deny, null/absent=inherit）'
  },
  scopes: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'per-user scopes override（null=inherit, array=replace）'
  },
  disabledReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '停用原因（可選）'
  },
  accessVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    comment: '權限版本號（權限/範圍/角色異動時遞增）',
  }
}, {
  tableName: 'teachers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['username']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['role']
    },
    {
      fields: ['teacherLevel']
    },
    {
      fields: ['accessVersion']
    }
  ]
});

module.exports = Teacher;
