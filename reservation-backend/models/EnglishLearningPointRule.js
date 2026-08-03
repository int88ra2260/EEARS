const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishLearningPointRule = sequelize.define('EnglishLearningPointRule', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  basePoints: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'base_points' },
  maxPointsPerWeek: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'max_points_per_week' },
  maxPointsTotal: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'max_points_total' },
  isOnceOnly: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_once_only' },
  requiresAttachment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'requires_attachment' },
  isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_enabled' },
  sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sort_order' },
}, {
  tableName: 'english_learning_point_rules',
  underscored: true,
});

module.exports = EnglishLearningPointRule;
