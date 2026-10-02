'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestMailBin = sequelize.define(
  'EnglishTestMailBin',
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: 'english_test_mail_bins',
    timestamps: true,
  }
);

module.exports = EnglishTestMailBin;
