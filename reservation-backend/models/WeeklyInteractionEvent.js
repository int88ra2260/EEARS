const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const WeeklyInteractionEvent = sequelize.define(
  'WeeklyInteractionEvent',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    reportId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    blockId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    eventType: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    voterKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'WeeklyInteractionEvents',
    timestamps: true,
    indexes: [
      { fields: ['reportId', 'eventType'] },
      { fields: ['reportId', 'blockId', 'eventType'] },
      {
        unique: true,
        fields: ['reportId', 'blockId', 'voterKey', 'eventType'],
        name: 'weekly_interaction_unique_vote',
      },
    ],
  }
);

module.exports = WeeklyInteractionEvent;
