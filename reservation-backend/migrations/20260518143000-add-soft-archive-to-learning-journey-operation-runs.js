'use strict';

async function hasColumn(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table && table[columnName]);
}

async function addColumnIfMissing(queryInterface, Sequelize, tableName, columnName, definition) {
  if (await hasColumn(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnIfExists(queryInterface, tableName, columnName) {
  if (!(await hasColumn(queryInterface, tableName, columnName))) return;
  await queryInterface.removeColumn(tableName, columnName);
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((index) => index.name === options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

async function removeIndexIfExists(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === indexName)) return;
  await queryInterface.removeIndex(tableName, indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'learning_journey_operation_runs';
    await addColumnIfMissing(queryInterface, Sequelize, table, 'archived_at', {
      type: Sequelize.DATE,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'archived_by_user_id', {
      type: Sequelize.STRING(64),
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'archived_by_username', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'archive_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, Sequelize, table, 'cleanup_request_id', {
      type: Sequelize.STRING(64),
      allowNull: true
    });

    await addIndexIfMissing(queryInterface, table, ['archived_at'], {
      name: 'idx_lj_operation_runs_archived_at'
    });
    await addIndexIfMissing(queryInterface, table, ['cleanup_request_id'], {
      name: 'idx_lj_operation_runs_cleanup_request'
    });
    await addIndexIfMissing(queryInterface, table, ['archived_by_user_id'], {
      name: 'idx_lj_operation_runs_archived_by'
    });
  },

  async down(queryInterface) {
    const table = 'learning_journey_operation_runs';
    await removeIndexIfExists(queryInterface, table, 'idx_lj_operation_runs_archived_by');
    await removeIndexIfExists(queryInterface, table, 'idx_lj_operation_runs_cleanup_request');
    await removeIndexIfExists(queryInterface, table, 'idx_lj_operation_runs_archived_at');

    await removeColumnIfExists(queryInterface, table, 'cleanup_request_id');
    await removeColumnIfExists(queryInterface, table, 'archive_reason');
    await removeColumnIfExists(queryInterface, table, 'archived_by_username');
    await removeColumnIfExists(queryInterface, table, 'archived_by_user_id');
    await removeColumnIfExists(queryInterface, table, 'archived_at');
  }
};
