'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EnglishTestMailBinMember = sequelize.define(
  'EnglishTestMailBinMember',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    binId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    registrationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: 'english_test_mail_bin_members',
    timestamps: true,
  }
);

module.exports = EnglishTestMailBinMember;
