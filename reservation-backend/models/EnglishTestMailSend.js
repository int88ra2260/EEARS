'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestMailSend = sequelize.define(
  'EnglishTestMailSend',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    batchId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    studentId: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    studentName: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sourceType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    versionLabel: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    templateKey: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    customTemplateId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    subject: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    sentByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'english_test_mail_sends',
    timestamps: true,
  }
);

module.exports = EnglishTestMailSend;
