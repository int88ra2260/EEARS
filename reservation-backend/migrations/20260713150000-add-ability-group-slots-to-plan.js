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
    if (!(await columnExists(queryInterface, 'et_event_group_plans', 'ability_group_slots'))) {
      await queryInterface.addColumn('et_event_group_plans', 'ability_group_slots', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '啟用能力分組的組別編號（1-based），null 表示全部組別',
      });
    }
  },

  async down(queryInterface) {
    if (await columnExists(queryInterface, 'et_event_group_plans', 'ability_group_slots')) {
      await queryInterface.removeColumn('et_event_group_plans', 'ability_group_slots');
    }
  },
};
