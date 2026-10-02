'use strict';

const TABLES = {
  tasks: 'speaking_tasks',
  attempts: 'speaking_attempts',
  ratings: 'speaking_human_ratings',
};

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(table);
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
      if (!(await tableExists(queryInterface, TABLES.tasks))) {
        await queryInterface.createTable(TABLES.tasks, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          task_key: { type: Sequelize.STRING(80), allowNull: false },
          level: { type: Sequelize.STRING(10), allowNull: false },
          task_type: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'read_aloud' },
          title: { type: Sequelize.STRING(120), allowNull: false },
          prompt: { type: Sequelize.TEXT, allowNull: false },
          target_text: { type: Sequelize.TEXT, allowNull: false },
          estimated_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          target_words: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          focus_tags: { type: Sequelize.JSON, allowNull: true },
          construct_tags: { type: Sequelize.JSON, allowNull: true },
          is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
          version: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'v0' },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
        await addIndexSafe(queryInterface, TABLES.tasks, ['task_key'], {
          unique: true,
          name: 'speaking_tasks_task_key_unique',
        }, transaction);
        await addIndexSafe(queryInterface, TABLES.tasks, ['level', 'task_type', 'is_active'], {
          name: 'speaking_tasks_level_type_active',
        }, transaction);
      }

      if (!(await tableExists(queryInterface, TABLES.attempts))) {
        await queryInterface.createTable(TABLES.attempts, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          attempt_uid: { type: Sequelize.STRING(64), allowNull: false },
          task_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.tasks, key: 'id' },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          student_id: { type: Sequelize.STRING(20), allowNull: true },
          client_session_id: { type: Sequelize.STRING(64), allowNull: false },
          submitted_at: { type: Sequelize.DATE, allowNull: false },
          audio_path: { type: Sequelize.STRING(255), allowNull: false },
          audio_mime_type: { type: Sequelize.STRING(80), allowNull: true },
          audio_size_bytes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          duration_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          transcript: { type: Sequelize.TEXT, allowNull: true },
          features: { type: Sequelize.JSON, allowNull: true },
          automated_scores: { type: Sequelize.JSON, allowNull: true },
          analysis_version: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'v0' },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'submitted' },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
        await addIndexSafe(queryInterface, TABLES.attempts, ['attempt_uid'], {
          unique: true,
          name: 'speaking_attempts_attempt_uid_unique',
        }, transaction);
        await addIndexSafe(queryInterface, TABLES.attempts, ['student_id', 'submitted_at'], {
          name: 'speaking_attempts_student_submitted',
        }, transaction);
        await addIndexSafe(queryInterface, TABLES.attempts, ['task_id', 'submitted_at'], {
          name: 'speaking_attempts_task_submitted',
        }, transaction);
      }

      if (!(await tableExists(queryInterface, TABLES.ratings))) {
        await queryInterface.createTable(TABLES.ratings, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          attempt_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.attempts, key: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          rater_user_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          fluency: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
          pronunciation_intelligibility: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
          grammar: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
          vocabulary: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
          task_achievement: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
          comments: { type: Sequelize.TEXT, allowNull: true },
          rubric_version: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'v0' },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
        await addIndexSafe(queryInterface, TABLES.ratings, ['attempt_id'], {
          name: 'speaking_human_ratings_attempt',
        }, transaction);
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, TABLES.ratings)) await queryInterface.dropTable(TABLES.ratings);
    if (await tableExists(queryInterface, TABLES.attempts)) await queryInterface.dropTable(TABLES.attempts);
    if (await tableExists(queryInterface, TABLES.tasks)) await queryInterface.dropTable(TABLES.tasks);
  },
};
