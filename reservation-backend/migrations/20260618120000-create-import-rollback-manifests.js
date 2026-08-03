'use strict';

const TABLE = 'import_rollback_manifests';

async function addIndexSafe(queryInterface, table, fields, options, transaction) {
  try {
    await queryInterface.addIndex(table, fields, { ...options, transaction });
  } catch (error) {
    const msg = String(error?.message || error || '');
    if (!msg.toLowerCase().includes('duplicate') && !msg.toLowerCase().includes('already exists')) {
      throw error;
    }
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      TABLE,
      {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        import_batch_id: {
          type: Sequelize.STRING(80),
          allowNull: false,
          unique: true,
        },
        source_module: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        kind: {
          type: Sequelize.STRING(40),
          allowNull: false,
        },
        audit_log_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
        },
        manifest_json: {
          type: Sequelize.JSON,
          allowNull: false,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      },
      { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
    );

    await addIndexSafe(queryInterface, TABLE, ['audit_log_id'], { name: 'idx_import_rollback_manifests_audit' });
    await addIndexSafe(queryInterface, TABLE, ['kind'], { name: 'idx_import_rollback_manifests_kind' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
