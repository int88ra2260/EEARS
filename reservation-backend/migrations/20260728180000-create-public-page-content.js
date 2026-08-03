'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = [
      'LearningResourceSites',
      'LearningResourceMiniGames',
      'LearningResourceGuides',
      'RegulationsFormsGroups',
      'RegulationsFormsItems',
      'ScrollWorldTestSegments'
    ];

    // MySQL: createTable will throw if table exists. Keep it deterministic for CI/dev.
    // If ENABLE_DB_SYNC is true, migration should run in a clean DB anyway.

    await queryInterface.createTable('LearningResourceSites', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      titleZh: { type: Sequelize.STRING(200), allowNull: true },
      titleEn: { type: Sequelize.STRING(200), allowNull: true },
      introZh: { type: Sequelize.TEXT('long'), allowNull: true },
      introEn: { type: Sequelize.TEXT('long'), allowNull: true },
      tag: { type: Sequelize.STRING(80), allowNull: true },
      href: { type: Sequelize.STRING(600), allowNull: false },
      titleKey: { type: Sequelize.STRING(160), allowNull: true },
      introKey: { type: Sequelize.STRING(160), allowNull: true },
      tagKey: { type: Sequelize.STRING(160), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('LearningResourceMiniGames', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      titleZh: { type: Sequelize.STRING(200), allowNull: true },
      titleEn: { type: Sequelize.STRING(200), allowNull: true },
      introZh: { type: Sequelize.TEXT('long'), allowNull: true },
      introEn: { type: Sequelize.TEXT('long'), allowNull: true },
      tag: { type: Sequelize.STRING(80), allowNull: true },
      href: { type: Sequelize.STRING(600), allowNull: false },
      isExternal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      titleKey: { type: Sequelize.STRING(160), allowNull: true },
      introKey: { type: Sequelize.STRING(160), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('LearningResourceGuides', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      titleZh: { type: Sequelize.STRING(200), allowNull: true },
      titleEn: { type: Sequelize.STRING(200), allowNull: true },
      introZh: { type: Sequelize.TEXT('long'), allowNull: true },
      introEn: { type: Sequelize.TEXT('long'), allowNull: true },
      tag: { type: Sequelize.STRING(80), allowNull: true },
      href: { type: Sequelize.STRING(600), allowNull: false },
      isExternal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      titleKey: { type: Sequelize.STRING(160), allowNull: true },
      introKey: { type: Sequelize.STRING(160), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('RegulationsFormsGroups', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      titleZh: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      titleEn: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('RegulationsFormsItems', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      groupId: { type: Sequelize.INTEGER, allowNull: false },
      titleZh: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      titleEn: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      fileUrl: { type: Sequelize.STRING(900), allowNull: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addConstraint('RegulationsFormsItems', {
      fields: ['groupId'],
      type: 'foreign key',
      name: 'fk_regulations_forms_items_group',
      references: {
        table: 'RegulationsFormsGroups',
        field: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.createTable('ScrollWorldTestSegments', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      sectionId: { type: Sequelize.STRING(32), allowNull: false, unique: true },
      labelZh: { type: Sequelize.STRING(200), allowNull: true },
      labelEn: { type: Sequelize.STRING(200), allowNull: true },
      titleZh: { type: Sequelize.STRING(400), allowNull: true },
      titleEn: { type: Sequelize.STRING(400), allowNull: true },
      bodyZh: { type: Sequelize.TEXT('long'), allowNull: true },
      bodyEn: { type: Sequelize.TEXT('long'), allowNull: true },
      primaryCtaLabelZh: { type: Sequelize.STRING(200), allowNull: true },
      primaryCtaLabelEn: { type: Sequelize.STRING(200), allowNull: true },
      primaryCtaHref: { type: Sequelize.STRING(900), allowNull: true },
      primaryCtaIsExternal: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      secondaryCtasJson: { type: Sequelize.TEXT('long'), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // Helpful indexes
    await queryInterface.addIndex('LearningResourceSites', ['isActive', 'sortOrder'], { name: 'idx_lr_sites_active_sort' });
    await queryInterface.addIndex('LearningResourceMiniGames', ['isActive', 'sortOrder'], { name: 'idx_lr_minigames_active_sort' });
    await queryInterface.addIndex('LearningResourceGuides', ['isActive', 'sortOrder'], { name: 'idx_lr_guides_active_sort' });
    await queryInterface.addIndex('RegulationsFormsGroups', ['isActive', 'sortOrder'], { name: 'idx_rf_groups_active_sort' });
    await queryInterface.addIndex('RegulationsFormsItems', ['isActive', 'sortOrder'], { name: 'idx_rf_items_active_sort' });
    await queryInterface.addIndex('ScrollWorldTestSegments', ['isActive', 'sortOrder'], { name: 'idx_swt_segments_active_sort' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ScrollWorldTestSegments');
    await queryInterface.dropTable('RegulationsFormsItems');
    await queryInterface.dropTable('RegulationsFormsGroups');
    await queryInterface.dropTable('LearningResourceGuides');
    await queryInterface.dropTable('LearningResourceMiniGames');
    await queryInterface.dropTable('LearningResourceSites');
  },
};

