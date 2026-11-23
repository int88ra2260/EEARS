'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SiteVisitBuckets', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      statDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      bucketType: {
        type: Sequelize.STRING(24),
        allowNull: false,
      },
      bucketKey: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      visitCount: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('SiteVisitBuckets', ['statDate', 'bucketType', 'bucketKey'], {
      unique: true,
      name: 'site_visit_buckets_stat_type_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SiteVisitBuckets');
  },
};
