'use strict';

const { QueryTypes } = require('sequelize');
const {
  DEFAULT_EVENT_TYPES,
} = require('../constants/eventTypeCatalog');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables();
      const normalized = tables.map((t) => String(t).toLowerCase());
      if (!normalized.includes('event_types')) {
        await queryInterface.createTable(
          'event_types',
          {
            code: {
              type: Sequelize.STRING(64),
              allowNull: false,
              primaryKey: true,
            },
            display_name: {
              type: Sequelize.STRING(120),
              allowNull: false,
            },
            abbreviation: {
              type: Sequelize.STRING(16),
              allowNull: false,
              defaultValue: '',
            },
            slug: {
              type: Sequelize.STRING(80),
              allowNull: false,
              unique: true,
            },
            sort_order: {
              type: Sequelize.INTEGER,
              allowNull: false,
              defaultValue: 100,
            },
            is_active: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
            },
            legacy_aliases: {
              type: Sequelize.JSON,
              allowNull: false,
            },
            open_rule: {
              type: Sequelize.JSON,
              allowNull: false,
            },
            cutoff_hours: {
              type: Sequelize.DECIMAL(5, 2),
              allowNull: false,
              defaultValue: 2,
            },
            capacity_mode: {
              type: Sequelize.STRING(20),
              allowNull: false,
              defaultValue: 'simple',
            },
            default_group_count: {
              type: Sequelize.INTEGER.UNSIGNED,
              allowNull: true,
            },
            default_per_group_capacity: {
              type: Sequelize.INTEGER.UNSIGNED,
              allowNull: true,
            },
            max_capacity_cap: {
              type: Sequelize.INTEGER.UNSIGNED,
              allowNull: true,
            },
            max_group_count: {
              type: Sequelize.INTEGER.UNSIGNED,
              allowNull: true,
            },
            max_per_group: {
              type: Sequelize.INTEGER.UNSIGNED,
              allowNull: true,
            },
            survey_gate_enabled: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },
            created_at: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
          },
          { transaction }
        );
      }

      const now = new Date();
      for (const row of DEFAULT_EVENT_TYPES) {
        await queryInterface.bulkInsert(
          'event_types',
          [
            {
              code: row.code,
              display_name: row.displayName,
              abbreviation: row.abbreviation,
              slug: row.slug,
              sort_order: row.sortOrder,
              is_active: row.isActive,
              legacy_aliases: JSON.stringify(row.legacyAliases || []),
              open_rule: JSON.stringify(row.openRule),
              cutoff_hours: row.cutoffHours,
              capacity_mode: row.capacityMode,
              default_group_count: row.defaultGroupCount,
              default_per_group_capacity: row.defaultPerGroupCapacity,
              max_capacity_cap: row.maxCapacityCap,
              max_group_count: row.maxGroupCount,
              max_per_group: row.maxPerGroup,
              survey_gate_enabled: row.surveyGateEnabled,
              created_at: now,
              updated_at: now,
            },
          ],
          {
            transaction,
            ignoreDuplicates: true,
          }
        );
      }

      // events.eventType：顯示名 → code
      const renames = [
        ["'English Table'", "'english_table'"],
        ["'ET'", "'english_table'"],
        ["'Job Talk'", "'job_talk'"],
        ["'JT'", "'job_talk'"],
        ["'English Club'", "'english_club'"],
        ["'EC'", "'english_club'"],
        ["'International Forum'", "'international_forum'"],
        ["'IF'", "'international_forum'"],
      ];
      for (const [from, to] of renames) {
        await queryInterface.sequelize.query(
          `UPDATE events SET eventType = ${to} WHERE eventType = ${from}`,
          { transaction, type: QueryTypes.UPDATE }
        );
      }

      // 預設值改為 code（若欄位支援 default）
      try {
        await queryInterface.changeColumn(
          'events',
          'eventType',
          {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'english_table',
          },
          { transaction }
        );
      } catch (_) {
        // 部分環境 changeColumn 對既有資料敏感，略過即可
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const renames = [
        ["'english_table'", "'English Table'"],
        ["'job_talk'", "'Job Talk'"],
        ["'english_club'", "'English Club'"],
        ["'international_forum'", "'International Forum'"],
      ];
      for (const [from, to] of renames) {
        await queryInterface.sequelize.query(
          `UPDATE events SET eventType = ${to} WHERE eventType = ${from}`,
          { transaction, type: QueryTypes.UPDATE }
        );
      }

      try {
        await queryInterface.changeColumn(
          'events',
          'eventType',
          {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: 'English Table',
          },
          { transaction }
        );
      } catch (_) {
        // ignore
      }

      await queryInterface.dropTable('event_types', { transaction });
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
