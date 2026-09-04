'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const desc = await queryInterface.describeTable('events');
      if (!desc.notes) {
        await queryInterface.addColumn(
          'events',
          'notes',
          {
            type: Sequelize.STRING(255),
            allowNull: true,
            defaultValue: '實踐歷程檔案',
            comment: '活動備註（預設：實踐歷程檔案）',
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE events SET notes = '實踐歷程檔案' WHERE notes IS NULL OR notes = ''`,
        { transaction }
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
      if (desc.notes) {
        await queryInterface.removeColumn('events', 'notes', { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
