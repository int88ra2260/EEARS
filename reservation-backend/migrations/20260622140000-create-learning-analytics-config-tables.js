'use strict';

const TABLES = {
  FILTER_REFS: 'learning_analytics_filter_references',
  CAPS_LEVELS: 'learning_analytics_caps_levels',
};

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

async function addIndexSafe(queryInterface, tableName, fields, options, transaction) {
  try {
    await queryInterface.addIndex(tableName, fields, { ...options, transaction });
  } catch (error) {
    const message = (error && error.message) || '';
    const mysqlCode = error && error.original && error.original.code;
    if (mysqlCode !== 'ER_DUP_KEYNAME' && !message.includes('Duplicate key name')) throw error;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!(await tableExists(queryInterface, TABLES.FILTER_REFS))) {
        await queryInterface.createTable(TABLES.FILTER_REFS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          ref_type: { type: Sequelize.STRING(30), allowNull: false },
          value: { type: Sequelize.STRING(120), allowNull: false },
          label: { type: Sequelize.STRING(160), allowNull: true },
          sort_order: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          created_by: { type: Sequelize.STRING(80), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(
        queryInterface,
        TABLES.FILTER_REFS,
        ['ref_type', 'value'],
        { name: 'uq_la_filter_ref_type_value', unique: true },
        transaction
      );

      if (!(await tableExists(queryInterface, TABLES.CAPS_LEVELS))) {
        await queryInterface.createTable(TABLES.CAPS_LEVELS, {
          cefr: { type: Sequelize.STRING(20), allowNull: false, primaryKey: true },
          caps_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
          updated_by: { type: Sequelize.STRING(80), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of [TABLES.CAPS_LEVELS, TABLES.FILTER_REFS]) {
        if (await tableExists(queryInterface, table)) {
          await queryInterface.dropTable(table, { transaction });
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
