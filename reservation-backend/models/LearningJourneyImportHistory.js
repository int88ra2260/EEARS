const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LearningJourneyImportHistory = sequelize.define('LearningJourneyImportHistory', {
  id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
  semesterId: { type: DataTypes.STRING(20), allowNull: true, field: 'semester_id' },
  importType: {
    type: DataTypes.ENUM('enrollment', 'external_exam', 'baseline_gsat'),
    allowNull: false,
    field: 'import_type'
  },
  sourceFile: { type: DataTypes.STRING(255), allowNull: true, field: 'source_file' },
  status: {
    type: DataTypes.ENUM('success', 'partial', 'failed', 'rolled_back'),
    allowNull: false,
    defaultValue: 'success'
  },
  importedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'imported_count' },
  updatedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'updated_count' },
  skippedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'skipped_count' },
  duplicateSkippedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'duplicate_skipped_count' },
  conflictedCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'conflicted_count' },
  warningCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'warning_count' },
  summaryJson: { type: DataTypes.JSON, allowNull: true, field: 'summary_json' }
}, {
  tableName: 'learning_journey_import_histories',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['semester_id', 'import_type'], name: 'idx_lj_import_histories_semester_type' },
    { fields: ['created_at'], name: 'idx_lj_import_histories_created_at' }
  ]
});

module.exports = LearningJourneyImportHistory;
