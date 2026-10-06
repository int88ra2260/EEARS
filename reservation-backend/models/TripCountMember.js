const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const TripCountMember = sequelize.define('TripCountMember', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  name: { type: DataTypes.STRING(40), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
}, {
  tableName: 'trip_count_members',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TripCountMember;
