'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningGrowthEpisode = sequelize.define('LearningGrowthEpisode', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  modelRunId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'model_run_id' },
  studentId: { type: DataTypes.STRING(20), allowNull: false, field: 'student_id' },
  preSnapshotId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'pre_snapshot_id' },
  postSnapshotId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: 'post_snapshot_id' },
  instrument: { type: DataTypes.STRING(40), allowNull: true },
  skill: { type: DataTypes.STRING(30), allowNull: false },
  startDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'start_date' },
  endDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'end_date' },
  monthsBetween: { type: DataTypes.DECIMAL(8, 2), allowNull: true, field: 'months_between' },
  previousGse: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'previous_gse' },
  postGse: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'post_gse' },
  actualGseGrowth: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'actual_gse_growth' },
  expectedGseGrowth: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'expected_gse_growth' },
  adjustedGseGrowth: { type: DataTypes.DECIMAL(5, 1), allowNull: true, field: 'adjusted_gse_growth' },
  evidenceQualityScore: { type: DataTypes.STRING(40), allowNull: true, field: 'evidence_quality_score' },
  estimateType: { type: DataTypes.STRING(50), allowNull: false, field: 'estimate_type' },
  causalClaimAllowed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'causal_claim_allowed' },
  payload: { type: DataTypes.JSON, allowNull: true },
}, {
  tableName: 'learning_growth_episodes',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = LearningGrowthEpisode;
