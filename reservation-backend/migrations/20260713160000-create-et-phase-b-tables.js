'use strict';

const TABLES = {
  TASK_TEMPLATES: 'et_task_templates',
  TASK_ITEMS: 'et_task_template_items',
  GROUP_LEADERS: 'et_event_group_leaders',
  SESSION_MARKS: 'et_session_task_marks',
};

const DEFAULT_TASK_ITEMS = [
  { code: 'ATTEND', label: '完成簽到並全程參與', description: '學生完成簽到並參與整場活動', band_scope: 'ALL', sort_order: 10, is_required: true },
  { code: 'PARTICIPATE', label: '至少主動發言 2 次', description: '能主動開口表達', band_scope: 'ALL', sort_order: 20, is_required: false },
  { code: 'PEER', label: '能回應同組同學提問', description: '與同組互動', band_scope: 'ALL', sort_order: 30, is_required: false },
  { code: 'A2_VOCAB', label: '使用當週主題詞彙 ≥3 個', description: 'A2 帶加強', band_scope: 'ET-A2', sort_order: 40, is_required: false },
  { code: 'A2_SENT', label: '能以完整句回答問題', description: 'A2 帶加強', band_scope: 'ET-A2', sort_order: 50, is_required: false },
  { code: 'B1_REASON', label: '能說明理由（because / since）', description: 'B1+ 帶加強', band_scope: 'B1_PLUS', sort_order: 60, is_required: false },
  { code: 'B1_FOLLOW', label: '能針對他人觀點追問或延伸', description: 'B1+ 帶加強', band_scope: 'B1_PLUS', sort_order: 70, is_required: false },
  { code: 'B2_STANCE', label: '能表明立場並舉例', description: 'B2+ 帶加強', band_scope: 'B2_PLUS', sort_order: 80, is_required: false },
  { code: 'B2_REBUT', label: '能禮貌反駁或提出替代方案', description: 'B2+ 帶加強', band_scope: 'B2_PLUS', sort_order: 90, is_required: false },
];

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
      if (!(await tableExists(queryInterface, TABLES.TASK_TEMPLATES))) {
        await queryInterface.createTable(
          TABLES.TASK_TEMPLATES,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            semester_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
            name: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'ET 預設任務模板' },
            is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
      }

      if (!(await tableExists(queryInterface, TABLES.TASK_ITEMS))) {
        await queryInterface.createTable(
          TABLES.TASK_ITEMS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            template_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            code: { type: Sequelize.STRING(30), allowNull: false },
            label: { type: Sequelize.STRING(120), allowNull: false },
            description: { type: Sequelize.STRING(255), allowNull: true },
            band_scope: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'ALL' },
            sort_order: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
            is_required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.TASK_ITEMS,
          ['template_id', 'code'],
          { name: 'uq_et_task_item_template_code', unique: true },
          transaction
        );
      }

      if (!(await tableExists(queryInterface, TABLES.GROUP_LEADERS))) {
        await queryInterface.createTable(
          TABLES.GROUP_LEADERS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            event_id: { type: Sequelize.INTEGER, allowNull: false },
            group_label: { type: Sequelize.STRING(40), allowNull: false },
            leader_teacher_id: { type: Sequelize.INTEGER, allowNull: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.GROUP_LEADERS,
          ['event_id', 'group_label'],
          { name: 'uq_et_group_leader_event_group', unique: true },
          transaction
        );
      }

      if (!(await tableExists(queryInterface, TABLES.SESSION_MARKS))) {
        await queryInterface.createTable(
          TABLES.SESSION_MARKS,
          {
            id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
            event_id: { type: Sequelize.INTEGER, allowNull: false },
            reservation_id: { type: Sequelize.INTEGER, allowNull: false },
            task_item_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
            completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
            marked_by: { type: Sequelize.INTEGER, allowNull: true },
            marked_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { allowNull: false, type: Sequelize.DATE },
            updated_at: { allowNull: false, type: Sequelize.DATE },
          },
          { transaction }
        );
        await addIndexSafe(
          queryInterface,
          TABLES.SESSION_MARKS,
          ['event_id', 'reservation_id', 'task_item_id'],
          { name: 'uq_et_session_mark', unique: true },
          transaction
        );
      }

      const now = new Date();
      const existingTemplates = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS cnt FROM ${TABLES.TASK_TEMPLATES} WHERE semester_id IS NULL`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      if (Number(existingTemplates[0]?.cnt || 0) === 0) {
        await queryInterface.bulkInsert(
          TABLES.TASK_TEMPLATES,
          [{
            semester_id: null,
            name: 'ET 全域預設任務',
            is_default: true,
            is_active: true,
            created_at: now,
            updated_at: now,
          }],
          { transaction }
        );
        const inserted = await queryInterface.sequelize.query(
          `SELECT id FROM ${TABLES.TASK_TEMPLATES} WHERE semester_id IS NULL AND is_default = 1 ORDER BY id DESC LIMIT 1`,
          { type: Sequelize.QueryTypes.SELECT, transaction }
        );
        const templateId = inserted[0]?.id;
        if (templateId) {
          await queryInterface.bulkInsert(
            TABLES.TASK_ITEMS,
            DEFAULT_TASK_ITEMS.map((item) => ({
              template_id: templateId,
              code: item.code,
              label: item.label,
              description: item.description,
              band_scope: item.band_scope,
              sort_order: item.sort_order,
              is_required: item.is_required,
              is_active: true,
              created_at: now,
              updated_at: now,
            })),
            { transaction }
          );
        }
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
      for (const table of [
        TABLES.SESSION_MARKS,
        TABLES.GROUP_LEADERS,
        TABLES.TASK_ITEMS,
        TABLES.TASK_TEMPLATES,
      ]) {
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
