const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishLearningAttachment = sequelize.define('EnglishLearningAttachment', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  submissionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'submission_id' },
  fileName: { type: DataTypes.STRING(255), allowNull: false, field: 'file_name' },
  filePath: { type: DataTypes.STRING(500), allowNull: false, field: 'file_path' },
  mimeType: { type: DataTypes.STRING(120), allowNull: true, field: 'mime_type' },
  fileSize: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: 'file_size' },
  uploadedBy: { type: DataTypes.STRING(80), allowNull: true, field: 'uploaded_by' },
}, {
  tableName: 'english_learning_attachments',
  underscored: true,
  updatedAt: false,
});

module.exports = EnglishLearningAttachment;
