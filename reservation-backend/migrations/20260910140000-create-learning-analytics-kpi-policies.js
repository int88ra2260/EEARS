'use strict';

const TABLE = 'learning_analytics_kpi_policies';

async function tableExists(queryInterface) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(TABLE);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface)) return;

    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      policy_key: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      name: { type: Sequelize.STRING(160), allowNull: false },
      academic_year: { type: Sequelize.STRING(20), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      definition_json: { type: Sequelize.JSON, allowNull: false },
      is_builtin: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_archived: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_by: { type: Sequelize.STRING(80), allowNull: true },
      updated_by: { type: Sequelize.STRING(80), allowNull: true },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex(TABLE, ['academic_year'], {
      name: 'idx_la_kpi_policies_academic_year',
    });
    await queryInterface.addIndex(TABLE, ['is_archived'], {
      name: 'idx_la_kpi_policies_archived',
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface)) {
      await queryInterface.dropTable(TABLE);
    }
  },
};
