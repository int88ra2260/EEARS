'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ResourceSkillProfile = sequelize.define('ResourceSkillProfile', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  resourceType: { type: DataTypes.STRING(60), allowNull: false, field: 'resource_type' },
  resourceId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'resource_id' },
  level: { type: DataTypes.STRING(50), allowNull: true },
  category: { type: DataTypes.STRING(50), allowNull: true },
  weightListening: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_listening' },
  weightReading: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_reading' },
  weightSpeaking: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_speaking' },
  weightWriting: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_writing' },
  weightInteraction: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_interaction' },
  weightMediation: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_mediation' },
  weightEap: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_eap' },
  weightEsp: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0, field: 'weight_esp' },
  expectedCefrMin: { type: DataTypes.STRING(20), allowNull: true, field: 'expected_cefr_min' },
  expectedCefrMax: { type: DataTypes.STRING(20), allowNull: true, field: 'expected_cefr_max' },
  createdBy: { type: DataTypes.STRING(80), allowNull: true, field: 'created_by' },
}, {
  tableName: 'resource_skill_profiles',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ResourceSkillProfile;
