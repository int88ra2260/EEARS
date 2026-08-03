'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ImportRollbackManifest = sequelize.define('ImportRollbackManifest', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  importBatchId: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
    field: 'import_batch_id',
    comment: '匯入批次識別碼',
  },
  sourceModule: {
    type: DataTypes.STRING(40),
    allowNull: false,
    field: 'source_module',
  },
  kind: {
    type: DataTypes.STRING(40),
    allowNull: false,
    comment: 'class_roster | event_card_excel',
  },
  auditLogId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'audit_log_id',
  },
  manifestJson: {
    type: DataTypes.JSON,
    allowNull: false,
    field: 'manifest_json',
  },
}, {
  tableName: 'import_rollback_manifests',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['import_batch_id'], unique: true, name: 'uk_import_rollback_manifests_batch' },
    { fields: ['audit_log_id'], name: 'idx_import_rollback_manifests_audit' },
    { fields: ['kind'], name: 'idx_import_rollback_manifests_kind' },
  ],
});

module.exports = ImportRollbackManifest;
