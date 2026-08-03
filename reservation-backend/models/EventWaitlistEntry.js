const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const EventWaitlistEntry = sequelize.define(
  'EventWaitlistEntry',
  {
    eventId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    studentId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    studentName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    studentEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'waiting',
    },
    promotedReservationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    promotedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'event_waitlist_entries',
    timestamps: true,
    underscored: false,
  }
);

module.exports = EventWaitlistEntry;
