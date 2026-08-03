'use strict';

const TABLE = 'learning_analytics_lva_config';

async function tableExists(queryInterface) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(TABLE);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface)) return;

    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, primaryKey: true, defaultValue: 1 },
      config_json: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface)) {
      await queryInterface.dropTable(TABLE);
    }
  },
};
