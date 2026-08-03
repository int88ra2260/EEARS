'use strict';

const TABLES = {
  ANALYTIC_EXAMS: 'lj_analytic_exams',
};

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === 'string' ? t : t.tableName || t.table_name));
  return normalized.includes(tableName);
}

async function columnExists(queryInterface, tableName, columnName) {
  const desc = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(desc, columnName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, TABLES.ANALYTIC_EXAMS))) return;

    const transaction = await queryInterface.sequelize.transaction();
    try {
      if (!(await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, 'exam_round'))) {
        await queryInterface.addColumn(TABLES.ANALYTIC_EXAMS, 'exam_round', {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
        }, { transaction });
      }
      if (!(await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, 'test_phase'))) {
        await queryInterface.addColumn(TABLES.ANALYTIC_EXAMS, 'test_phase', {
          type: Sequelize.STRING(20),
          allowNull: true,
        }, { transaction });
      }
      if (!(await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, 'session_date_start'))) {
        await queryInterface.addColumn(TABLES.ANALYTIC_EXAMS, 'session_date_start', {
          type: Sequelize.DATEONLY,
          allowNull: true,
        }, { transaction });
      }
      if (!(await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, 'session_date_end'))) {
        await queryInterface.addColumn(TABLES.ANALYTIC_EXAMS, 'session_date_end', {
          type: Sequelize.DATEONLY,
          allowNull: true,
        }, { transaction });
      }
      if (!(await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, 'exposure_window_start'))) {
        await queryInterface.addColumn(TABLES.ANALYTIC_EXAMS, 'exposure_window_start', {
          type: Sequelize.DATEONLY,
          allowNull: true,
        }, { transaction });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, TABLES.ANALYTIC_EXAMS))) return;

    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const column of [
        'exposure_window_start',
        'session_date_end',
        'session_date_start',
        'test_phase',
        'exam_round',
      ]) {
        if (await columnExists(queryInterface, TABLES.ANALYTIC_EXAMS, column)) {
          await queryInterface.removeColumn(TABLES.ANALYTIC_EXAMS, column, { transaction });
        }
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
