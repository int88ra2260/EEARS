'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'SiteContentEntries',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          entryType: {
            type: Sequelize.STRING(16),
            allowNull: false,
            defaultValue: 'text',
          },
          section: {
            type: Sequelize.STRING(32),
            allowNull: false,
          },
          contentKey: {
            type: Sequelize.STRING(160),
            allowNull: true,
          },
          label: {
            type: Sequelize.STRING(200),
            allowNull: false,
            defaultValue: '',
          },
          valueZh: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
          },
          valueEn: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
          },
          bodyZh: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
          },
          bodyEn: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
          },
          sortOrder: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          isActive: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          updatedBy: {
            type: Sequelize.INTEGER,
            allowNull: true,
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex('SiteContentEntries', ['entryType', 'section', 'sortOrder'], {
        name: 'idx_site_content_section_sort',
        transaction,
      });

      await queryInterface.addIndex('SiteContentEntries', ['contentKey'], {
        name: 'idx_site_content_key',
        unique: true,
        transaction,
      });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SiteContentEntries');
  },
};
