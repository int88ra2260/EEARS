'use strict';

const TABLE = 'resource_skill_profiles';

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
      if (!(await tableExists(queryInterface, TABLE))) {
        await queryInterface.createTable(TABLE, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          resource_type: { type: Sequelize.STRING(60), allowNull: false },
          resource_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
          level: { type: Sequelize.STRING(50), allowNull: true },
          category: { type: Sequelize.STRING(50), allowNull: true },
          weight_listening: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_reading: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_speaking: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_writing: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_interaction: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_mediation: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_eap: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          weight_esp: { type: Sequelize.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
          expected_cefr_min: { type: Sequelize.STRING(20), allowNull: true },
          expected_cefr_max: { type: Sequelize.STRING(20), allowNull: true },
          created_by: { type: Sequelize.STRING(80), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(
        queryInterface,
        TABLE,
        ['resource_type', 'resource_id'],
        { name: 'uq_resource_skill_profiles_type_id', unique: true },
        transaction
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
      if (await tableExists(queryInterface, TABLE)) {
        await queryInterface.dropTable(TABLE, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
