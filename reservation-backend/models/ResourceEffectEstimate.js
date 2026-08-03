'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ResourceEffectEstimate = sequelize.define('ResourceEffectEstimate', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  modelRunId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'model_run_id' },
  resourceType: { type: DataTypes.STRING(60), allowNull: false, field: 'resource_type' },
  resourceId: { type: DataTypes.STRING(80), allowNull: true, field: 'resource_id' },
  skill: { type: DataTypes.STRING(30), allowNull: true },
  estimateType: { type: DataTypes.STRING(50), allowNull: false, field: 'estimate_type' },
  rawEffect: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'raw_effect' },
  adjustedEffect: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'adjusted_effect' },
  causalEffect: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'causal_effect' },
  confidenceIntervalLow: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'confidence_interval_low' },
  confidenceIntervalHigh: { type: DataTypes.DECIMAL(12, 4), allowNull: true, field: 'confidence_interval_high' },
  sampleSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'sample_size' },
  evidenceQuality: { type: DataTypes.STRING(40), allowNull: true, field: 'evidence_quality' },
  causalClaimAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'causal_claim_allowed' },
  modelVersion: { type: DataTypes.STRING(80), allowNull: false, field: 'model_version' },
  payload: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'resource_effect_estimates',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ResourceEffectEstimate;
