const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const TripCount = sequelize.define('TripCount', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ownerUserId: { type: DataTypes.INTEGER, allowNull: false, field: 'owner_user_id' },
  title: { type: DataTypes.STRING(80), allowNull: false },
  note: { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: 'trip_counts',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TripCount;
