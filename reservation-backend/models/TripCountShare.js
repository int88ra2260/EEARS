const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const TripCountShare = sequelize.define('TripCountShare', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  expenseId: { type: DataTypes.INTEGER, allowNull: false, field: 'expense_id' },
  memberId: { type: DataTypes.INTEGER, allowNull: false, field: 'member_id' },
  shareCents: { type: DataTypes.INTEGER, allowNull: true, field: 'share_cents' },
}, {
  tableName: 'trip_count_shares',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TripCountShare;
