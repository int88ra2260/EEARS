'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtSessionTaskMark = sequelize.define(
  'EtSessionTaskMark',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    reservationId: { type: DataTypes.INTEGER, allowNull: false, field: 'reservation_id' },
    taskItemId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'task_item_id' },
    completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    markedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'marked_by' },
    markedAt: { type: DataTypes.DATE, allowNull: true, field: 'marked_at' },
  },
  {
    tableName: 'et_session_task_marks',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtSessionTaskMark;
