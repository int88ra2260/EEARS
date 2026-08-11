'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('MediaAssets', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      key: { type: Sequelize.STRING(120), allowNull: true, unique: true },
      url: { type: Sequelize.STRING(500), allowNull: false, unique: true },
      label: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      originalName: { type: Sequelize.STRING(250), allowNull: true },
      storedName: { type: Sequelize.STRING(250), allowNull: true },
      mime: { type: Sequelize.STRING(100), allowNull: true },
      source: { type: Sequelize.STRING(32), allowNull: false, defaultValue: 'upload' },
      scope: { type: Sequelize.STRING(64), allowNull: false, defaultValue: 'general' },
      byteSize: { type: Sequelize.INTEGER, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      uploadedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('MediaAssets', ['scope', 'isActive'], {
      name: 'idx_media_assets_scope_active',
    });
    await queryInterface.addIndex('MediaAssets', ['source'], {
      name: 'idx_media_assets_source',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('MediaAssets');
  },
};
