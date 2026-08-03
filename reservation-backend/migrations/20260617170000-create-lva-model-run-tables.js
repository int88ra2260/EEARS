'use strict';

const TABLES = {
  MODEL_RUNS: 'analytics_model_runs',
  RESOURCE_EFFECTS: 'resource_effect_estimates',
  GROWTH_EPISODES: 'learning_growth_episodes',
  RESOURCE_EXPOSURES: 'student_resource_exposures',
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
      if (!(await tableExists(queryInterface, TABLES.MODEL_RUNS))) {
        await queryInterface.createTable(TABLES.MODEL_RUNS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          model_name: { type: Sequelize.STRING(80), allowNull: false },
          model_version: { type: Sequelize.STRING(80), allowNull: false },
          contract_version: { type: Sequelize.STRING(80), allowNull: false },
          snapshot_version: { type: Sequelize.STRING(120), allowNull: true },
          semester: { type: Sequelize.STRING(20), allowNull: true },
          filters_payload: { type: Sequelize.JSON, allowNull: true },
          supported_filters_payload: { type: Sequelize.JSON, allowNull: true },
          included_students_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          excluded_students_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          missing_data_summary: { type: Sequelize.JSON, allowNull: true },
          estimate_policy_payload: { type: Sequelize.JSON, allowNull: true },
          status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'completed' },
          started_at: { type: Sequelize.DATE, allowNull: false },
          finished_at: { type: Sequelize.DATE, allowNull: true },
          created_by: { type: Sequelize.STRING(80), allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(queryInterface, TABLES.MODEL_RUNS, ['model_name', 'model_version'], { name: 'idx_lva_model_runs_model' }, transaction);
      await addIndexSafe(queryInterface, TABLES.MODEL_RUNS, ['snapshot_version', 'created_at'], { name: 'idx_lva_model_runs_snapshot' }, transaction);

      if (!(await tableExists(queryInterface, TABLES.RESOURCE_EFFECTS))) {
        await queryInterface.createTable(TABLES.RESOURCE_EFFECTS, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          model_run_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
          resource_type: { type: Sequelize.STRING(60), allowNull: false },
          resource_id: { type: Sequelize.STRING(80), allowNull: true },
          skill: { type: Sequelize.STRING(30), allowNull: true },
          estimate_type: { type: Sequelize.STRING(50), allowNull: false },
          raw_effect: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
          adjusted_effect: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
          causal_effect: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
          confidence_interval_low: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
          confidence_interval_high: { type: Sequelize.DECIMAL(12, 4), allowNull: true },
          sample_size: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          evidence_quality: { type: Sequelize.STRING(40), allowNull: true },
          causal_claim_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          model_version: { type: Sequelize.STRING(80), allowNull: false },
          payload: { type: Sequelize.JSON, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(queryInterface, TABLES.RESOURCE_EFFECTS, ['model_run_id', 'resource_type'], { name: 'idx_lva_resource_effect_run' }, transaction);

      if (!(await tableExists(queryInterface, TABLES.GROWTH_EPISODES))) {
        await queryInterface.createTable(TABLES.GROWTH_EPISODES, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          model_run_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
          student_id: { type: Sequelize.STRING(20), allowNull: false },
          pre_snapshot_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          post_snapshot_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          instrument: { type: Sequelize.STRING(40), allowNull: true },
          skill: { type: Sequelize.STRING(30), allowNull: false },
          start_date: { type: Sequelize.DATEONLY, allowNull: true },
          end_date: { type: Sequelize.DATEONLY, allowNull: true },
          months_between: { type: Sequelize.DECIMAL(8, 2), allowNull: true },
          previous_caps: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          post_caps: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          actual_caps_growth: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          expected_caps_growth: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          adjusted_caps_growth: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
          evidence_quality_score: { type: Sequelize.STRING(40), allowNull: true },
          estimate_type: { type: Sequelize.STRING(50), allowNull: false },
          causal_claim_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          payload: { type: Sequelize.JSON, allowNull: true },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(queryInterface, TABLES.GROWTH_EPISODES, ['model_run_id', 'student_id', 'skill'], { name: 'idx_lva_growth_run_student' }, transaction);

      if (!(await tableExists(queryInterface, TABLES.RESOURCE_EXPOSURES))) {
        await queryInterface.createTable(TABLES.RESOURCE_EXPOSURES, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          model_run_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
          student_id: { type: Sequelize.STRING(20), allowNull: false },
          source_event_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          resource_type: { type: Sequelize.STRING(60), allowNull: false },
          resource_id: { type: Sequelize.STRING(80), allowNull: true },
          participation_date: { type: Sequelize.DATEONLY, allowNull: true },
          duration_minutes: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          attendance_status: { type: Sequelize.STRING(40), allowNull: true },
          attendance_quality: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
          skill_exposure_payload: { type: Sequelize.JSON, allowNull: true },
          time_decay_weight: { type: Sequelize.DECIMAL(8, 4), allowNull: true },
          valid_for_test_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
          estimate_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'descriptive' },
          causal_claim_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          created_at: { allowNull: false, type: Sequelize.DATE },
          updated_at: { allowNull: false, type: Sequelize.DATE },
        }, { transaction });
      }
      await addIndexSafe(queryInterface, TABLES.RESOURCE_EXPOSURES, ['model_run_id', 'student_id'], { name: 'idx_lva_exposure_run_student' }, transaction);
      await addIndexSafe(queryInterface, TABLES.RESOURCE_EXPOSURES, ['resource_type', 'participation_date'], { name: 'idx_lva_exposure_resource_date' }, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of [TABLES.RESOURCE_EXPOSURES, TABLES.GROWTH_EPISODES, TABLES.RESOURCE_EFFECTS, TABLES.MODEL_RUNS]) {
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
