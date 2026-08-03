'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtEventGroupLeader = sequelize.define(
  'EtEventGroupLeader',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    groupLabel: { type: DataTypes.STRING(40), allowNull: false, field: 'group_label' },
    leaderTeacherId: { type: DataTypes.INTEGER, allowNull: true, field: 'leader_teacher_id' },
  },
  {
    tableName: 'et_event_group_leaders',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtEventGroupLeader;
