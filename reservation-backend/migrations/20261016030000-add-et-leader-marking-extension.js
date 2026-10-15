'use strict';

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Object.prototype.hasOwnProperty.call(description, column);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'et_leader_attendances';
    if (!(await columnExists(queryInterface, table, 'marking_open_until'))) {
      await queryInterface.addColumn(table, 'marking_open_until', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, table, 'marking_open_note'))) {
      await queryInterface.addColumn(table, 'marking_open_note', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, table, 'marking_opened_by'))) {
      await queryInterface.addColumn(table, 'marking_opened_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = 'et_leader_attendances';
    if (await columnExists(queryInterface, table, 'marking_opened_by')) {
      await queryInterface.removeColumn(table, 'marking_opened_by');
    }
    if (await columnExists(queryInterface, table, 'marking_open_note')) {
      await queryInterface.removeColumn(table, 'marking_open_note');
    }
    if (await columnExists(queryInterface, table, 'marking_open_until')) {
      await queryInterface.removeColumn(table, 'marking_open_until');
    }
  },
};
