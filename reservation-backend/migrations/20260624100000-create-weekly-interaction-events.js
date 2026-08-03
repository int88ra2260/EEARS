'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'WeeklyInteractionEvents',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          reportId: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'WeeklyReports', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          blockId: {
            type: Sequelize.STRING(64),
            allowNull: true,
          },
          eventType: {
            type: Sequelize.STRING(32),
            allowNull: false,
          },
          voterKey: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },
          payload: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      );

      await queryInterface.addIndex(
        'WeeklyInteractionEvents',
        ['reportId', 'eventType'],
        { name: 'weekly_interaction_report_type', transaction }
      );

      await queryInterface.addIndex(
        'WeeklyInteractionEvents',
        ['reportId', 'blockId', 'eventType'],
        { name: 'weekly_interaction_report_block_type', transaction }
      );

      await queryInterface.addIndex(
        'WeeklyInteractionEvents',
        ['reportId', 'blockId', 'voterKey', 'eventType'],
        {
          name: 'weekly_interaction_unique_vote',
          unique: true,
          transaction,
        }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WeeklyInteractionEvents');
  },
};
