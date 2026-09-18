'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'et_leader_pay_profiles'))) {
      await queryInterface.createTable('et_leader_pay_profiles', {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        leader_teacher_id: { type: Sequelize.INTEGER, allowNull: false },
        seniority_years: {
          type: Sequelize.DECIMAL(4, 1),
          allowNull: false,
          defaultValue: 0,
          comment: '年資（年）',
        },
        hourly_rate: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
          defaultValue: 0,
          comment: '時薪（新台幣）',
        },
        note: { type: Sequelize.STRING(255), allowNull: true },
        created_at: { allowNull: false, type: Sequelize.DATE },
        updated_at: { allowNull: false, type: Sequelize.DATE },
      });
      await queryInterface.addIndex('et_leader_pay_profiles', ['leader_teacher_id'], {
        name: 'uq_et_leader_pay_profile_teacher',
        unique: true,
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'et_leader_pay_profiles')) {
      await queryInterface.dropTable('et_leader_pay_profiles');
    }
  },
};
