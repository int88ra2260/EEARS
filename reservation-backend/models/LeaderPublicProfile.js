const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const LeaderPublicProfile = sequelize.define(
  'LeaderPublicProfile',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    slug: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    displayName: { type: DataTypes.STRING(80), allowNull: false },
    /** @deprecated 改用 LeaderSemesterAssignment.sortOrder */
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    /** @deprecated 改用 LeaderSemesterAssignment.isPublished */
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    isArchived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    photoUrl: { type: DataTypes.STRING(500), allowNull: true },
    degree: { type: DataTypes.STRING(120), allowNull: true },
    experience: { type: DataTypes.STRING(300), allowNull: true },
    languages: { type: DataTypes.STRING(120), allowNull: true },
    focus: { type: DataTypes.STRING(120), allowNull: true },
    videoId: { type: DataTypes.STRING(20), allowNull: true },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'LeaderPublicProfiles',
    timestamps: true,
  },
);

module.exports = LeaderPublicProfile;
