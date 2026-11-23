'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const SiteVisitBucket = sequelize.define('SiteVisitBucket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  statDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  bucketType: {
    type: DataTypes.STRING(24),
    allowNull: false,
  },
  bucketKey: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  visitCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'SiteVisitBuckets',
});

module.exports = SiteVisitBucket;
