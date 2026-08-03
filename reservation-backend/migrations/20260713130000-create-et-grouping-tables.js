'use strict';

const TABLES = {
  BAND_CONFIGS: 'et_group_band_configs',
  GROUP_PLANS: 'et_event_group_plans',
  GROUP_ASSIGNMENTS: 'et_event_group_assignments',
};

const DEFAULT_BANDS = [
  {
    code: 'ET-A2',
    label: 'A1–A2 基礎',
    caps_min: 0,
    caps_max: 349,
    cefr_min: 'A1',
    cefr_max: 'A2',
    max_per_table: 12,
    table_count: 2,
    sort_order: 10,
  },
  {
    code: 'ET-B1',
    label: 'B1 主題表達',
    caps_min: 350,
    caps_max: 549,
    cefr_min: 'B1',
    cefr_max: 'B1',
    max_per_table: 12,
    table_count: 2,
    sort_order: 20,
  },
  {
    code: 'ET-B2',
    label: 'B2 觀點組織',
    caps_min: 550,
    caps_max: 749,
    cefr_min: 'B2',
    cefr_max: 'B2',
    max_per_table: 12,
    table_count: 2,
    sort_order: 30,
  },
  {
    code: 'ET-C1',
    label: 'C1+ 深度討論',
    caps_min: 750,
    caps_max: 9999,
    cefr_min: 'C1',
    cefr_max: 'C2',
    max_per_table: 12,
    table_count: 1,
    sort_order: 40,
  },
  {
    code: 'ET-UNK',
    label: '待確認',
    caps_min: null,
    caps_max: null,
    cefr_min: null,
    cefr_max: null,
    max_per_table: 12,
    table_count: 1,
    sort_order: 99,
  },
];

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const desc = await queryInterface.describeTable(tableName);
    return Boolean(desc[columnName]);
  } catch {
    return false;
  }
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
      if (!(await columnExists(queryInterface, 'events', 'grouping_mode'))) {
        await queryInterface.addColumn(
          'events',
          'grouping_mode',
          {
            type: Sequelize.STRING(30),
            allowNull: false,
            defaultValue: 'legacy_sequential',
            comment: 'ET 分組模式：legacy_sequential | ability',
          },
          { transaction }
        );
      }

      if (!(await tableExists(queryInterface, TABLES.BAND_CONFIGS))) {
        await queryInterface.createTable(
          TABLES.BAND_CONFIGS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            semester_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            code: { type: Sequelize.STRING(20), allowNull: false },
            label: { type: Sequelize.STRING(80), allowNull: false },
            caps_min: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            caps_max: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            cefr_min: { type: Sequelize.STRING(10), allowNull: true },
            cefr_max: { type: Sequelize.STRING(10), allowNull: true },
            max_per_table: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 12 },
            table_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
            sort_order: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.BAND_CONFIGS,
          ['semester_id', 'code'],
          { name: 'uq_et_band_semester_code', unique: true },
          transaction
        );
      }

      if (!(await tableExists(queryInterface, TABLES.GROUP_PLANS))) {
        await queryInterface.createTable(
          TABLES.GROUP_PLANS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            event_id: { type: Sequelize.INTEGER, allowNull: false },
            status: {
              type: Sequelize.STRING(20),
              allowNull: false,
              defaultValue: 'draft',
            },
            algorithm_version: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'v1' },
            generated_at: { type: Sequelize.DATE, allowNull: true },
            published_at: { type: Sequelize.DATE, allowNull: true },
            published_by: { type: Sequelize.INTEGER, allowNull: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.GROUP_PLANS,
          ['event_id'],
          { name: 'uq_et_group_plan_event', unique: true },
          transaction
        );
      }

      if (!(await tableExists(queryInterface, TABLES.GROUP_ASSIGNMENTS))) {
        await queryInterface.createTable(
          TABLES.GROUP_ASSIGNMENTS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            event_id: { type: Sequelize.INTEGER, allowNull: false },
            reservation_id: { type: Sequelize.INTEGER, allowNull: false },
            student_id: { type: Sequelize.STRING(20), allowNull: false },
            band_code: { type: Sequelize.STRING(20), allowNull: false },
            group_label: { type: Sequelize.STRING(40), allowNull: false },
            caps_snapshot: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            cefr_snapshot: { type: Sequelize.STRING(10), allowNull: true },
            data_quality: {
              type: Sequelize.STRING(20),
              allowNull: false,
              defaultValue: 'missing',
            },
            source: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'auto' },
            leader_teacher_id: { type: Sequelize.INTEGER, allowNull: true },
            adjusted_by: { type: Sequelize.INTEGER, allowNull: true },
            adjusted_at: { type: Sequelize.DATE, allowNull: true },
            adjust_reason: { type: Sequelize.STRING(255), allowNull: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.GROUP_ASSIGNMENTS,
          ['event_id', 'reservation_id'],
          { name: 'uq_et_assignment_event_reservation', unique: true },
          transaction
        );
        await addIndexSafe(
          queryInterface,
          TABLES.GROUP_ASSIGNMENTS,
          ['event_id', 'group_label'],
          { name: 'idx_et_assignment_event_group', unique: false },
          transaction
        );
      }

      const now = new Date();
      const existing = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS cnt FROM ${TABLES.BAND_CONFIGS} WHERE semester_id IS NULL`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      const count = Number(existing[0]?.cnt || 0);
      if (count === 0) {
        await queryInterface.bulkInsert(
          TABLES.BAND_CONFIGS,
          DEFAULT_BANDS.map((band) => ({
            semester_id: null,
            code: band.code,
            label: band.label,
            caps_min: band.caps_min,
            caps_max: band.caps_max,
            cefr_min: band.cefr_min,
            cefr_max: band.cefr_max,
            max_per_table: band.max_per_table,
            table_count: band.table_count,
            sort_order: band.sort_order,
            is_active: true,
            created_at: now,
            updated_at: now,
          })),
          { transaction }
        );
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
      for (const table of [TABLES.GROUP_ASSIGNMENTS, TABLES.GROUP_PLANS, TABLES.BAND_CONFIGS]) {
        if (await tableExists(queryInterface, table)) {
          await queryInterface.dropTable(table, { transaction });
        }
      }
      if (await columnExists(queryInterface, 'events', 'grouping_mode')) {
        await queryInterface.removeColumn('events', 'grouping_mode', { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
