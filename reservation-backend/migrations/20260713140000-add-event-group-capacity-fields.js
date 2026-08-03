'use strict';

const { QueryTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const desc = await queryInterface.describeTable('events');
      if (!desc.group_count) {
        await queryInterface.addColumn(
          'events',
          'group_count',
          {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true,
            comment: '分組數（English Table 等）',
          },
          { transaction }
        );
      }
      if (!desc.per_group_capacity) {
        await queryInterface.addColumn(
          'events',
          'per_group_capacity',
          {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true,
            comment: '每組人數上限',
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE events
         SET group_count = 9,
             per_group_capacity = GREATEST(1, CEIL(maxCapacity / 9))
         WHERE eventType = 'English Table'
           AND (group_count IS NULL OR per_group_capacity IS NULL)`,
        { transaction, type: QueryTypes.UPDATE }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const desc = await queryInterface.describeTable('events');
      if (desc.per_group_capacity) {
        await queryInterface.removeColumn('events', 'per_group_capacity', { transaction });
      }
      if (desc.group_count) {
        await queryInterface.removeColumn('events', 'group_count', { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
