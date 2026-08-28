'use strict';

const TABLE = 'learning_trace_events';

async function tableExists(queryInterface) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(TABLE);
}

async function addIndexSafe(queryInterface, fields, options, transaction) {
  try {
    await queryInterface.addIndex(TABLE, fields, { ...options, transaction });
  } catch (error) {
    const message = (error && error.message) || '';
    const mysqlCode = error && error.original && error.original.code;
    if (mysqlCode !== 'ER_DUP_KEYNAME' && !message.includes('Duplicate key name')) throw error;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface)) return;

    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(TABLE, {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        trace_id: { type: Sequelize.STRING(64), allowNull: false },
        game_id: { type: Sequelize.STRING(40), allowNull: false },
        event_type: {
          type: Sequelize.ENUM('session_start', 'session_complete'),
          allowNull: false,
        },
        client_session_id: { type: Sequelize.STRING(64), allowNull: false },
        student_id: { type: Sequelize.STRING(20), allowNull: true },
        occurred_at: { type: Sequelize.DATE, allowNull: false },
        duration_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        score: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
        accuracy: { type: Sequelize.DECIMAL(5, 4), allowNull: true },
        cefr_level: { type: Sequelize.STRING(10), allowNull: true },
        skill_tags: { type: Sequelize.JSON, allowNull: true },
        payload: { type: Sequelize.JSON, allowNull: true },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      }, { transaction });

      await addIndexSafe(queryInterface, ['trace_id'], {
        unique: true,
        name: 'learning_trace_events_trace_id_unique',
      }, transaction);
      await addIndexSafe(queryInterface, ['game_id', 'occurred_at'], {
        name: 'learning_trace_events_game_occurred',
      }, transaction);
      await addIndexSafe(queryInterface, ['client_session_id'], {
        name: 'learning_trace_events_client_session',
      }, transaction);
      await addIndexSafe(queryInterface, ['student_id'], {
        name: 'learning_trace_events_student_id',
      }, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface))) return;
    await queryInterface.dropTable(TABLE);
  },
};
