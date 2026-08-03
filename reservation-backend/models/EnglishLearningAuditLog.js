const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishLearningAuditLog = sequelize.define('EnglishLearningAuditLog', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  actorId: { type: DataTypes.STRING(80), allowNull: true, field: 'actor_id' },
  actorRole: { type: DataTypes.STRING(40), allowNull: true, field: 'actor_role' },
  action: { type: DataTypes.STRING(64), allowNull: false },
  targetType: { type: DataTypes.STRING(64), allowNull: false, field: 'target_type' },
  targetId: { type: DataTypes.STRING(64), allowNull: false, field: 'target_id' },
  beforeJson: { type: DataTypes.JSON, allowNull: true, field: 'before_json' },
  afterJson: { type: DataTypes.JSON, allowNull: true, field: 'after_json' },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true, field: 'ip_address' },
  userAgent: { type: DataTypes.STRING(500), allowNull: true, field: 'user_agent' },
}, {
  tableName: 'english_learning_audit_logs',
  underscored: true,
  updatedAt: false,
});

module.exports = EnglishLearningAuditLog;
