'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtLeaderPayProfile = sequelize.define(
  'EtLeaderPayProfile',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    leaderTeacherId: { type: DataTypes.INTEGER, allowNull: false, field: 'leader_teacher_id' },
    seniorityYears: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: false,
      defaultValue: 0,
      field: 'seniority_years',
    },
    hourlyRate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: 'hourly_rate',
    },
    note: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: 'et_leader_pay_profiles',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtLeaderPayProfile;
