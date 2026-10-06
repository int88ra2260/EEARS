'use strict';

const TABLES = ['trip_count_shares', 'trip_count_expenses', 'trip_count_members', 'trip_counts'];

async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((item) => (typeof item === 'string' ? item : item.tableName || item.table_name));
  return normalized.includes(table);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!(await tableExists(queryInterface, 'trip_counts'))) {
        await queryInterface.createTable('trip_counts', {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          owner_user_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'Users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          title: { type: Sequelize.STRING(80), allowNull: false },
          note: { type: Sequelize.STRING(500), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex('trip_counts', ['owner_user_id'], {
          name: 'idx_trip_counts_owner',
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, 'trip_count_members'))) {
        await queryInterface.createTable('trip_count_members', {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          trip_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'trip_counts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          name: { type: Sequelize.STRING(40), allowNull: false },
          sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex('trip_count_members', ['trip_id', 'sort_order'], {
          name: 'idx_trip_count_members_trip',
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, 'trip_count_expenses'))) {
        await queryInterface.createTable('trip_count_expenses', {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          trip_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'trip_counts', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          title: { type: Sequelize.STRING(80), allowNull: false },
          amount_cents: { type: Sequelize.INTEGER, allowNull: false },
          payer_member_id: { type: Sequelize.INTEGER, allowNull: false },
          split_mode: { type: Sequelize.STRING(16), allowNull: false },
          note: { type: Sequelize.STRING(200), allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex('trip_count_expenses', ['trip_id'], {
          name: 'idx_trip_count_expenses_trip',
          transaction,
        });
      }

      if (!(await tableExists(queryInterface, 'trip_count_shares'))) {
        await queryInterface.createTable('trip_count_shares', {
          id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
          expense_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'trip_count_expenses', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
          },
          member_id: { type: Sequelize.INTEGER, allowNull: false },
          share_cents: { type: Sequelize.INTEGER, allowNull: true },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        }, { transaction });
        await queryInterface.addIndex('trip_count_shares', ['expense_id', 'member_id'], {
          name: 'uniq_trip_count_shares_expense_member',
          unique: true,
          transaction,
        });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    const [adminRows] = await queryInterface.sequelize.query(
      "SELECT id FROM role_permissions WHERE role = 'admin' LIMIT 1"
    );
    if (adminRows.length) {
      const now = new Date();
      await queryInterface.bulkInsert('role_permissions', [{
        role: 'admin',
        permission: 'can_use_trip_count',
        createdAt: now,
        updatedAt: now,
      }], { ignoreDuplicates: true });
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_permissions', {
      role: 'admin',
      permission: 'can_use_trip_count',
    });
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const table of TABLES) {
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
