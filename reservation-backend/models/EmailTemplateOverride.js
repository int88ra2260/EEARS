'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EmailTemplateOverride = sequelize.define(
  'EmailTemplateOverride',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    templateKey: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    subjectTemplate: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    bodyTemplate: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    isEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    updatedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'email_template_overrides',
    timestamps: true,
  }
);

module.exports = EmailTemplateOverride;
