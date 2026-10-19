'use strict';

const { ET_LEGACY_TASK_CODES, ET_SHARED_TASK_ITEMS } = require('../constants/etSharedTaskItems');

const TEMPLATES = 'et_task_templates';
const ITEMS = 'et_task_template_items';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((table) => (typeof table === 'string' ? table : table.tableName || table.table_name));
  return normalized.includes(tableName);
}

async function templateIds(queryInterface, Sequelize, transaction) {
  const rows = await queryInterface.sequelize.query(
    `SELECT id FROM ${TEMPLATES}`,
    { type: Sequelize.QueryTypes.SELECT, transaction }
  );
  return rows.map((row) => row.id);
}

async function ensureDefaultTemplate(queryInterface, Sequelize, transaction, now) {
  const ids = await templateIds(queryInterface, Sequelize, transaction);
  if (ids.length) return ids;
  await queryInterface.bulkInsert(TEMPLATES, [{
    semester_id: null,
    name: 'ET 全域預設任務',
    is_default: true,
    is_active: true,
    created_at: now,
    updated_at: now,
  }], { transaction });
  return templateIds(queryInterface, Sequelize, transaction);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, ITEMS))) return;

    const transaction = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();
      const codes = ET_SHARED_TASK_ITEMS.map((item) => item.code);
      const ids = await ensureDefaultTemplate(queryInterface, Sequelize, transaction, now);

      await queryInterface.sequelize.query(
        `UPDATE ${ITEMS}
         SET is_active = 0, updated_at = :now
         WHERE code NOT IN (:codes)`,
        { replacements: { now, codes }, transaction }
      );

      for (const templateId of ids) {
        for (const item of ET_SHARED_TASK_ITEMS) {
          await queryInterface.sequelize.query(
            `INSERT INTO ${ITEMS}
              (template_id, code, label, description, band_scope, sort_order, is_required, is_active, created_at, updated_at)
             VALUES
              (:templateId, :code, :label, :description, :bandScope, :sortOrder, :isRequired, 1, :now, :now)
             ON DUPLICATE KEY UPDATE
              label = VALUES(label),
              description = VALUES(description),
              band_scope = VALUES(band_scope),
              sort_order = VALUES(sort_order),
              is_required = VALUES(is_required),
              is_active = 1,
              updated_at = VALUES(updated_at)`,
            {
              replacements: {
                templateId,
                code: item.code,
                label: item.label,
                description: item.description,
                bandScope: item.bandScope,
                sortOrder: item.sortOrder,
                isRequired: item.isRequired ? 1 : 0,
                now,
              },
              transaction,
            }
          );
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, ITEMS))) return;

    const transaction = await queryInterface.sequelize.transaction();
    try {
      const now = new Date();
      const sharedCodes = ET_SHARED_TASK_ITEMS.map((item) => item.code);
      await queryInterface.sequelize.query(
        `UPDATE ${ITEMS} SET is_active = 0, updated_at = :now WHERE code IN (:codes)`,
        { replacements: { now, codes: sharedCodes }, transaction }
      );
      if (ET_LEGACY_TASK_CODES.length) {
        await queryInterface.sequelize.query(
          `UPDATE ${ITEMS} SET is_active = 1, updated_at = :now WHERE code IN (:codes)`,
          { replacements: { now, codes: ET_LEGACY_TASK_CODES }, transaction }
        );
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
