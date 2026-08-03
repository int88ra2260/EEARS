const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ActivityParticipation = sequelize.define('ActivityParticipation', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  studentPk: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'student_pk' },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  semesterId: { type: DataTypes.STRING(12), allowNull: true, field: 'semester_id' },
  eventId: { type: DataTypes.STRING(40), allowNull: false, field: 'event_id' },
  activityType: { type: DataTypes.ENUM('ET', 'EC', 'IF', 'EWL'), allowNull: false, field: 'activity_type' },
  attendanceStatus: {
    type: DataTypes.ENUM('registered', 'attended', 'absent', 'cancelled'),
    allowNull: false,
    defaultValue: 'registered',
    field: 'attendance_status'
  },
  participatedAt: { type: DataTypes.DATE, allowNull: true, field: 'participated_at' },
  sourceRef: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'unknown', field: 'source_ref' },
  metaJson: { type: DataTypes.JSON, allowNull: true, field: 'meta_json' }
}, {
  tableName: 'activity_participations',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['student_id', 'event_id', 'source_ref'], name: 'uk_ap_student_event_source' },
    { fields: ['student_pk', 'semester_id'], name: 'idx_ap_student_pk_semester' }
  ]
});

module.exports = ActivityParticipation;
