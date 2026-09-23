'use strict';

/** 後台時數調整改掛在學生總時數，class_id 可為空。 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (!names.includes('class_credit_adjustments')) return;

    await queryInterface.changeColumn('class_credit_adjustments', 'class_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (!names.includes('class_credit_adjustments')) return;

    await queryInterface.sequelize.query(
      'DELETE FROM class_credit_adjustments WHERE class_id IS NULL',
    );
    await queryInterface.changeColumn('class_credit_adjustments', 'class_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  },
};
