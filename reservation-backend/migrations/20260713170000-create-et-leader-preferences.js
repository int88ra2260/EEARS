'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'et_leader_preferences'))) {
      await queryInterface.createTable('et_leader_preferences', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        semester_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        group_label: { type: Sequelize.STRING(40), allowNull: false },
        leader_teacher_id: { type: Sequelize.INTEGER, allowNull: false },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      });
      await queryInterface.addIndex('et_leader_preferences', ['semester_id', 'group_label'], {
        name: 'uq_et_leader_pref_semester_group',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'et_leader_preferences')) {
      await queryInterface.dropTable('et_leader_preferences');
    }
  },
};
