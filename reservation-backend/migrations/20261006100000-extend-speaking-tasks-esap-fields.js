'use strict';

const TABLE = 'speaking_tasks';

async function describeTableSafe(queryInterface, table) {
  try {
    return await queryInterface.describeTable(table);
  } catch (_) {
    return null;
  }
}

async function addColumnSafe(queryInterface, table, column, definition, transaction) {
  const desc = await describeTableSafe(queryInterface, table);
  if (!desc || desc[column]) return;
  await queryInterface.addColumn(table, column, definition, { transaction });
}

async function removeColumnSafe(queryInterface, table, column, transaction) {
  const desc = await describeTableSafe(queryInterface, table);
  if (!desc || !desc[column]) return;
  await queryInterface.removeColumn(table, column, { transaction });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await addColumnSafe(queryInterface, TABLE, 'discipline', {
        type: Sequelize.STRING(80),
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'communication_function', {
        type: Sequelize.STRING(80),
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'target_vocabulary', {
        type: Sequelize.JSON,
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'teacher_goal', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'linked_course', {
        type: Sequelize.STRING(120),
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'linked_activity', {
        type: Sequelize.STRING(120),
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'suggested_supports', {
        type: Sequelize.JSON,
        allowNull: true,
      }, transaction);
      await addColumnSafe(queryInterface, TABLE, 'teacher_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      }, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const column of [
        'teacher_notes',
        'suggested_supports',
        'linked_activity',
        'linked_course',
        'teacher_goal',
        'target_vocabulary',
        'communication_function',
        'discipline',
      ]) {
        await removeColumnSafe(queryInterface, TABLE, column, transaction);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};