'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (names.includes('class_credit_adjustments')) return;

    await queryInterface.createTable('class_credit_adjustments', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      semester: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: '學期，如 114-2',
      },
      student_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      class_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'classes', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      hours: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        comment: '正數加時、負數扣時',
      },
      note: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('class_credit_adjustments', ['semester', 'student_id'], {
      name: 'class_credit_adjustments_student_semester',
    });
    await queryInterface.addIndex('class_credit_adjustments', ['semester', 'class_id'], {
      name: 'class_credit_adjustments_semester_class',
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (!names.includes('class_credit_adjustments')) return;
    await queryInterface.dropTable('class_credit_adjustments');
  },
};
