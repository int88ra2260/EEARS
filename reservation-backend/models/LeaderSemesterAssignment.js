'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LeaderSemesterAssignment = sequelize.define(
  'LeaderSemesterAssignment',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    leaderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    semesterId: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: '學期代碼，如 114-1、114-2',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '該學期是否顯示於前台',
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '該學期的顯示排序',
    },
  },
  {
    tableName: 'LeaderSemesterAssignments',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['leaderId', 'semesterId'],
        name: 'leader_semester_unique',
      },
    ],
  },
);

module.exports = LeaderSemesterAssignment;
