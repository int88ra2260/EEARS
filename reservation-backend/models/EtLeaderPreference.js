'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtLeaderPreference = sequelize.define(
  'EtLeaderPreference',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    semesterId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'semester_id' },
    groupLabel: { type: DataTypes.STRING(40), allowNull: false, field: 'group_label' },
    leaderTeacherId: { type: DataTypes.INTEGER, allowNull: false, field: 'leader_teacher_id' },
  },
  {
    tableName: 'et_leader_preferences',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtLeaderPreference;
