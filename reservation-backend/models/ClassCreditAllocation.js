'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ClassCreditAllocation = sequelize.define(
  'ClassCreditAllocation',
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
      allowNull: false,
      field: 'class_id',
    },
    allocatedHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'allocated_hours',
    },
  },
  {
    tableName: 'class_credit_allocations',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['semester', 'student_id', 'class_id'],
        name: 'class_credit_allocations_unique',
      },
      {
        fields: ['semester', 'class_id'],
        name: 'class_credit_allocations_semester_class',
      },
      {
        fields: ['student_id', 'semester'],
        name: 'class_credit_allocations_student_semester',
      },
    ],
  },
);

module.exports = ClassCreditAllocation;
