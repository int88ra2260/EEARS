'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('english_learning_point_rules').catch(() => null);
    if (cols && !cols.bonus_points) {
      await queryInterface.addColumn('english_learning_point_rules', 'bonus_points', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: '加碼點數：競賽得獎、校外英檢達門檻時使用',
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE english_learning_point_rules
      SET bonus_points = 50
      WHERE code = 'ENGLISH_COMPETITION' AND bonus_points IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE english_learning_point_rules
      SET bonus_points = 40
      WHERE code = 'EXTERNAL_EXAM' AND bonus_points IS NULL
    `);
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('english_learning_point_rules').catch(() => null);
    if (cols?.bonus_points) {
      await queryInterface.removeColumn('english_learning_point_rules', 'bonus_points');
    }
  },
};
