'use strict';

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Object.prototype.hasOwnProperty.call(description, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'et_leader_attendances';
    if (!(await columnExists(queryInterface, table, 'pay_released_at'))) {
      await queryInterface.addColumn(table, 'pay_released_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, table, 'pay_release_note'))) {
      await queryInterface.addColumn(table, 'pay_release_note', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, table, 'pay_released_by'))) {
      await queryInterface.addColumn(table, 'pay_released_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'et_leader_attendances';
    if (await columnExists(queryInterface, table, 'pay_released_by')) {
      await queryInterface.removeColumn(table, 'pay_released_by');
    }
    if (await columnExists(queryInterface, table, 'pay_release_note')) {
      await queryInterface.removeColumn(table, 'pay_release_note');
    }
    if (await columnExists(queryInterface, table, 'pay_released_at')) {
      await queryInterface.removeColumn(table, 'pay_released_at');
    }
  },
};
