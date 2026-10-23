'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const tables = await queryInterface.showAllTables();
      const normalized = tables.map((t) => String(t).toLowerCase());
      const eventsDesc = await queryInterface.describeTable('events');

      if (!eventsDesc.open_rule) {
        await queryInterface.addColumn('events', 'open_rule', {
          type: Sequelize.JSON,
          allowNull: true,
        }, { transaction });
      }
      if (!eventsDesc.capacity_mode) {
        await queryInterface.addColumn('events', 'capacity_mode', {
          type: Sequelize.STRING(20),
          allowNull: true,
        }, { transaction });
      }
      if (!eventsDesc.hidden_from_students) {
        await queryInterface.addColumn('events', 'hidden_from_students', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }, { transaction });
      }

      await queryInterface.changeColumn('events', 'notes', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: null,
      }, { transaction });

      await queryInterface.sequelize.query(
        "UPDATE events SET notes = NULL WHERE notes = '實踐歷程檔案'",
        { transaction }
      );

      if (normalized.includes('event_types')) {
        const [existing] = await queryInterface.sequelize.query(
          "SELECT code FROM event_types WHERE code = 'other' LIMIT 1",
          { transaction }
        );
        if (!existing.length) {
          const now = new Date();
          await queryInterface.bulkInsert('event_types', [{
            code: 'other',
            display_name: '其他',
            abbreviation: 'OT',
            slug: 'other',
            sort_order: 50,
            is_active: true,
            legacy_aliases: JSON.stringify(['其他', 'Other']),
            open_rule: JSON.stringify({ type: 'day_before', days: 1, hour: 12, minute: 0 }),
            cutoff_hours: 2,
            capacity_mode: 'simple',
            default_group_count: 2,
            default_per_group_capacity: 10,
            max_capacity_cap: 300,
            max_group_count: 20,
            max_per_group: 30,
            survey_gate_enabled: false,
            created_at: now,
            updated_at: now,
          }], { transaction });
        }
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
      const tables = await queryInterface.showAllTables();
      const normalized = tables.map((t) => String(t).toLowerCase());
      if (normalized.includes('event_types')) {
        await queryInterface.bulkDelete('event_types', { code: 'other' }, { transaction });
      }

      const eventsDesc = await queryInterface.describeTable('events');
      if (eventsDesc.hidden_from_students) {
        await queryInterface.removeColumn('events', 'hidden_from_students', { transaction });
      }
      if (eventsDesc.capacity_mode) {
        await queryInterface.removeColumn('events', 'capacity_mode', { transaction });
      }
      if (eventsDesc.open_rule) {
        await queryInterface.removeColumn('events', 'open_rule', { transaction });
      }

      await queryInterface.changeColumn('events', 'notes', {
        type: Sequelize.STRING(255),
        allowNull: true,
        defaultValue: '實踐歷程檔案',
      }, { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },
};
