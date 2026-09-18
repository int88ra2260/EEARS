'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'et_leader_attendances'))) {
      await queryInterface.createTable('et_leader_attendances', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false },
        leader_teacher_id: { type: Sequelize.INTEGER, allowNull: false },
        check_in_at: { type: Sequelize.DATE, allowNull: false },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: 'on_time | late | manual',
        },
        method: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: 'qr | manual',
        },
        marked_by: { type: Sequelize.INTEGER, allowNull: true },
        note: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      });
      await queryInterface.addIndex('et_leader_attendances', ['event_id', 'leader_teacher_id'], {
        name: 'uq_et_leader_attendance_event_leader',
        unique: true,
      });
      await queryInterface.addIndex('et_leader_attendances', ['event_id'], {
        name: 'idx_et_leader_attendance_event',
      });
    }

    if (!(await tableExists(queryInterface, 'et_leader_checkin_tokens'))) {
      await queryInterface.createTable('et_leader_checkin_tokens', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        event_id: { type: Sequelize.INTEGER, allowNull: false },
        token_hash: { type: Sequelize.STRING(64), allowNull: false },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        rotated_at: { type: Sequelize.DATE, allowNull: false },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      });
      await queryInterface.addIndex('et_leader_checkin_tokens', ['event_id'], {
        name: 'uq_et_leader_checkin_token_event',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'et_leader_attendances')) {
      await queryInterface.dropTable('et_leader_attendances');
    }
    if (await tableExists(queryInterface, 'et_leader_checkin_tokens')) {
      await queryInterface.dropTable('et_leader_checkin_tokens');
    }
  },
};
