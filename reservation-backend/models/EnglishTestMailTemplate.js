'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestMailTemplate = sequelize.define(
  'EnglishTestMailTemplate',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    subjectTemplate: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    bodyTemplate: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    updatedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'english_test_mail_templates',
    timestamps: true,
  }
);

module.exports = EnglishTestMailTemplate;
