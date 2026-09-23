'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClassCreditAdjustment = sequelize.define(
  'ClassCreditAdjustment',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: '學期，如 114-2',
    },
    studentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'student_id',
    },
    classId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'class_id',
      comment: '空值表示調整學生總時數；舊資料才會綁班級',
    },
    hours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      comment: '正數增加總時數、負數扣除；不直接改某一班配置',
    },
    note: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'created_by',
    },
  },
  {
    tableName: 'class_credit_adjustments',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['semester', 'student_id'],
        name: 'class_credit_adjustments_student_semester',
      },
      {
        fields: ['semester', 'class_id'],
        name: 'class_credit_adjustments_semester_class',
      },
    ],
  },
);

module.exports = ClassCreditAdjustment;
