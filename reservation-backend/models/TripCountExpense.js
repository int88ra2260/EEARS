const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const TripCountExpense = sequelize.define('TripCountExpense', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  title: { type: DataTypes.STRING(80), allowNull: false },
  amountCents: { type: DataTypes.INTEGER, allowNull: false, field: 'amount_cents' },
  payerMemberId: { type: DataTypes.INTEGER, allowNull: false, field: 'payer_member_id' },
  splitMode: { type: DataTypes.STRING(16), allowNull: false, field: 'split_mode' },
  note: { type: DataTypes.STRING(200), allowNull: true },
}, {
  tableName: 'trip_count_expenses',
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = TripCountExpense;
