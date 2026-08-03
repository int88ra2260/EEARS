'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('learning_journey_import_histories', 'import_type', {
      type: Sequelize.ENUM('enrollment', 'external_exam', 'baseline_gsat'),
      allowNull: false,
    });
    await queryInterface.changeColumn('learning_journey_import_histories', 'status', {
      type: Sequelize.ENUM('success', 'partial', 'failed', 'rolled_back'),
      allowNull: false,
      defaultValue: 'success',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('learning_journey_import_histories', 'import_type', {
      type: Sequelize.ENUM('enrollment', 'external_exam'),
      allowNull: false,
    });
    await queryInterface.changeColumn('learning_journey_import_histories', 'status', {
      type: Sequelize.ENUM('success', 'partial', 'failed'),
      allowNull: false,
      defaultValue: 'success',
    });
  },
};
