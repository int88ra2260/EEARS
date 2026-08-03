'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EtEventGroupAssignment = sequelize.define(
  'EtEventGroupAssignment',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false, field: 'event_id' },
    reservationId: { type: DataTypes.INTEGER, allowNull: false, field: 'reservation_id' },
    studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
    bandCode: { type: DataTypes.STRING(20), allowNull: false, field: 'band_code' },
    groupLabel: { type: DataTypes.STRING(40), allowNull: false, field: 'group_label' },
    gseSnapshot: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'gse_snapshot' },
    cefrSnapshot: { type: DataTypes.STRING(10), allowNull: true, field: 'cefr_snapshot' },
    dataQuality: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'missing', field: 'data_quality' },
    source: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'auto' },
    leaderTeacherId: { type: DataTypes.INTEGER, allowNull: true, field: 'leader_teacher_id' },
    adjustedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'adjusted_by' },
    adjustedAt: { type: DataTypes.DATE, allowNull: true, field: 'adjusted_at' },
    adjustReason: { type: DataTypes.STRING(255), allowNull: true, field: 'adjust_reason' },
  },
  {
    tableName: 'et_event_group_assignments',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = EtEventGroupAssignment;
