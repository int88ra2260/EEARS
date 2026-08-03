const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishLearningSubmission = sequelize.define('EnglishLearningSubmission', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  passportId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'passport_id' },
  studentId: { type: DataTypes.STRING(50), allowNull: false, field: 'student_id' },
  ruleCode: { type: DataTypes.STRING(64), allowNull: false, field: 'rule_code' },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
  activityDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'activity_date' },
  title: { type: DataTypes.STRING(255), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  pointsRequested: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    field: 'points_requested',
  },
  pointsApproved: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'points_approved' },
  metadataJson: { type: DataTypes.JSON, allowNull: true, field: 'metadata_json' },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  reviewedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'reviewed_by' },
  reviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'reviewed_at' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
}, {
  tableName: 'english_learning_submissions',
  underscored: true,
});

module.exports = EnglishLearningSubmission;
