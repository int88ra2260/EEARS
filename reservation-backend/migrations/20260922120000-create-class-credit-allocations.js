'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (names.includes('class_credit_allocations')) return;

    await queryInterface.createTable('class_credit_allocations', {
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
      allocated_hours: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addIndex('class_credit_allocations', ['semester', 'student_id', 'class_id'], {
      unique: true,
      name: 'class_credit_allocations_unique',
    });
    await queryInterface.addIndex('class_credit_allocations', ['semester', 'class_id'], {
      name: 'class_credit_allocations_semester_class',
    });
    await queryInterface.addIndex('class_credit_allocations', ['student_id', 'semester'], {
      name: 'class_credit_allocations_student_semester',
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.name || '')).map((s) => String(s).toLowerCase());
    if (!names.includes('class_credit_allocations')) return;
    await queryInterface.dropTable('class_credit_allocations');
  },
};
