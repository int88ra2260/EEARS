'use strict';

const bcrypt = require('bcryptjs');

const TABLES = {
  hosts: 'speaking_hosts',
  sets: 'speaking_check_sets',
  items: 'speaking_check_items',
  participants: 'speaking_check_participants',
  responses: 'speaking_check_responses',
};

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name));
  return normalized.includes(table);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!(await tableExists(queryInterface, TABLES.hosts))) {
        await queryInterface.createTable(TABLES.hosts, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          username: { type: Sequelize.STRING(40), allowNull: false, unique: true },
          password_hash: { type: Sequelize.STRING(100), allowNull: false },
          display_name: { type: Sequelize.STRING(40), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
      }

      if (!(await tableExists(queryInterface, TABLES.sets))) {
        await queryInterface.createTable(TABLES.sets, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          host_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.hosts, key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          title: { type: Sequelize.STRING(80), allowNull: false },
          join_code: { type: Sequelize.STRING(6), allowNull: true, unique: true },
          status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' },
          published_at: { type: Sequelize.DATE, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex(TABLES.sets, ['host_id', 'status'], { name: 'speaking_check_sets_host_status', transaction });
      }

      if (!(await tableExists(queryInterface, TABLES.items))) {
        await queryInterface.createTable(TABLES.items, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          set_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.sets, key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          position: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
          title: { type: Sequelize.STRING(40), allowNull: false },
          target_text: { type: Sequelize.TEXT, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex(TABLES.items, ['set_id', 'position'], { name: 'speaking_check_items_set_position', transaction });
      }

      if (!(await tableExists(queryInterface, TABLES.participants))) {
        await queryInterface.createTable(TABLES.participants, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          participant_uid: { type: Sequelize.STRING(36), allowNull: false, unique: true },
          set_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.sets, key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          display_name: { type: Sequelize.STRING(30), allowNull: false },
          client_session_id: { type: Sequelize.STRING(64), allowNull: false },
          joined_at: { type: Sequelize.DATE, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex(
          TABLES.participants,
          ['set_id', 'client_session_id'],
          { name: 'speaking_check_participants_set_session', unique: true, transaction },
        );
      }

      if (!(await tableExists(queryInterface, TABLES.responses))) {
        await queryInterface.createTable(TABLES.responses, {
          id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
          participant_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.participants, key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          item_id: {
            type: Sequelize.BIGINT.UNSIGNED,
            allowNull: false,
            references: { model: TABLES.items, key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          transcript: { type: Sequelize.TEXT, allowNull: true },
          duration_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          fluency_percent: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          completion_percent: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          pronunciation_percent: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
          word_results: { type: Sequelize.JSON, allowNull: true },
          submitted_at: { type: Sequelize.DATE, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex(
          TABLES.responses,
          ['participant_id', 'item_id'],
          { name: 'speaking_check_responses_participant_item', unique: true, transaction },
        );
      }

      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM speaking_hosts WHERE username = :username LIMIT 1',
        { replacements: { username: 'mike' }, transaction },
      );
      if (!existing.length) {
        const now = new Date();
        await queryInterface.bulkInsert(TABLES.hosts, [{
          username: 'mike',
          password_hash: bcrypt.hashSync('1234', 10),
          display_name: 'Mike',
          created_at: now,
          updated_at: now,
        }], { transaction });
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
      await queryInterface.dropTable(TABLES.responses, { transaction });
      await queryInterface.dropTable(TABLES.participants, { transaction });
      await queryInterface.dropTable(TABLES.items, { transaction });
      await queryInterface.dropTable(TABLES.sets, { transaction });
      await queryInterface.dropTable(TABLES.hosts, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
