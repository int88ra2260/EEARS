const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishLearningPassport = sequelize.define('EnglishLearningPassport', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  studentId: { type: DataTypes.STRING(50), allowNull: false, field: 'student_id' },
  studentName: { type: DataTypes.STRING(120), allowNull: false, field: 'student_name' },
  studentEmail: { type: DataTypes.STRING(200), allowNull: false, field: 'student_email' },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'pending',
  },
  applicationReason: { type: DataTypes.TEXT, allowNull: true, field: 'application_reason' },
  reviewedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  totalApprovedPoints: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    field: 'total_approved_points',
  },
  completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
  certificationStatus: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'none',
    field: 'certification_status',
  },
  certificationRequestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'certification_requested_at',
  },
  certificationReviewedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'certification_reviewed_by',
  },
  certificationReviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'certification_reviewed_at',
  },
  certificationRejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'certification_rejection_reason',
  },
}, {
  tableName: 'english_learning_passports',
  underscored: true,
});

module.exports = EnglishLearningPassport;
