'use strict';

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const desc = await queryInterface.describeTable(tableName);
    return Boolean(desc[columnName]);
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'et_event_group_plans', 'grouping_layout'))) {
      await queryInterface.addColumn('et_event_group_plans', 'grouping_layout', {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'physical_slots',
        comment: 'physical_slots | band_tables',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'et_event_group_plans', 'grouping_layout')) {
      await queryInterface.removeColumn('et_event_group_plans', 'grouping_layout');
    }
  },
};
