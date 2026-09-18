'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtLeaderAttendance = sequelize.define(
  'EtLeaderAttendance',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    leaderTeacherId: { type: DataTypes.INTEGER, allowNull: false, field: 'leader_teacher_id' },
    checkInAt: { type: DataTypes.DATE, allowNull: false, field: 'check_in_at' },
    status: { type: DataTypes.STRING(20), allowNull: false },
    method: { type: DataTypes.STRING(20), allowNull: false },
    markedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'marked_by' },
    note: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: 'et_leader_attendances',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtLeaderAttendance;
