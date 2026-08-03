'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('SiteContentEntries', 'email', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn('SiteContentEntries', 'extension', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('SiteContentEntries', 'extension');
    await queryInterface.removeColumn('SiteContentEntries', 'email');
  },
};
