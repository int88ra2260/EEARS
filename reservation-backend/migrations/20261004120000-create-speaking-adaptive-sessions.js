'use strict';

const TABLES = {
  sessions: 'speaking_adaptive_sessions',
  attempts: 'speaking_attempts',
};

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(table);
}

async function columnExists(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table).catch(() => null);
  return Boolean(desc && desc[column]);
}

async function addIndexSafe(queryInterface, table, fields, options, transaction) {
  try {
    await queryInterface.addIndex(table, fields, { ...options, transaction });
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
      if (!(await tableExists(queryInterface, TABLES.sessions))) {
        await queryInterface.createTable(TABLES.sessions, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          session_uid: { type: Sequelize.STRING(64), allowNull: false },
          client_session_id: { type: Sequelize.STRING(64), allowNull: false },
          student_id: { type: Sequelize.STRING(20), allowNull: true },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'active' },
          started_at: { type: Sequelize.DATE, allowNull: false },
          completed_at: { type: Sequelize.DATE, allowNull: true },
          initial_level: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'B1' },
          current_level: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'B1' },
          current_ability: { type: Sequelize.FLOAT, allowNull: true },
          standard_error: { type: Sequelize.FLOAT, allowNull: true },
          min_tasks: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 4 },
          max_tasks: { type: Sequelize.TINYINT.UNSIGNED, allowNull: false, defaultValue: 8 },
          completed_task_keys: { type: Sequelize.JSON, allowNull: true },
          construct_coverage: { type: Sequelize.JSON, allowNull: true },
          task_type_coverage: { type: Sequelize.JSON, allowNull: true },
          path: { type: Sequelize.JSON, allowNull: true },
          decision_log: { type: Sequelize.JSON, allowNull: true },
          result_summary: { type: Sequelize.JSON, allowNull: true },
          stop_reason: { type: Sequelize.STRING(120), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
        await addIndexSafe(queryInterface, TABLES.sessions, ['session_uid'], {
          unique: true,
          name: 'speaking_adaptive_sessions_uid_unique',
        }, transaction);
        await addIndexSafe(queryInterface, TABLES.sessions, ['client_session_id', 'started_at'], {
          name: 'speaking_adaptive_sessions_client_started',
        }, transaction);
        await addIndexSafe(queryInterface, TABLES.sessions, ['student_id', 'started_at'], {
          name: 'speaking_adaptive_sessions_student_started',
        }, transaction);
      }

      if (await tableExists(queryInterface, TABLES.attempts) && !(await columnExists(queryInterface, TABLES.attempts, 'adaptive_session_uid'))) {
        await queryInterface.addColumn(TABLES.attempts, 'adaptive_session_uid', {
          type: Sequelize.STRING(64),
          allowNull: true,
          after: 'client_session_id',
        }, { transaction });
        await addIndexSafe(queryInterface, TABLES.attempts, ['adaptive_session_uid', 'submitted_at'], {
          name: 'speaking_attempts_adaptive_session_submitted',
        }, transaction);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, TABLES.attempts) && await columnExists(queryInterface, TABLES.attempts, 'adaptive_session_uid')) {
      await queryInterface.removeColumn(TABLES.attempts, 'adaptive_session_uid');
    }
    if (await tableExists(queryInterface, TABLES.sessions)) await queryInterface.dropTable(TABLES.sessions);
  },
};
