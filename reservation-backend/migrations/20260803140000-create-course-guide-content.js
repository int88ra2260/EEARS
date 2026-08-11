'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CourseGuideSections', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      sectionKey: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      titleZh: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      titleEn: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      introZh: { type: Sequelize.TEXT('long'), allowNull: true },
      introEn: { type: Sequelize.TEXT('long'), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.createTable('CourseGuideTopics', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      sectionId: { type: Sequelize.INTEGER, allowNull: false },
      topicKey: { type: Sequelize.STRING(64), allowNull: false },
      titleZh: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      titleEn: { type: Sequelize.STRING(250), allowNull: false, defaultValue: '' },
      defaultOpen: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      contentJson: { type: Sequelize.TEXT('long'), allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      updatedBy: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addConstraint('CourseGuideTopics', {
      fields: ['sectionId'],
      type: 'foreign key',
      name: 'fk_course_guide_topics_section',
      references: { table: 'CourseGuideSections', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });

    await queryInterface.addIndex('CourseGuideTopics', ['sectionId', 'sortOrder'], {
      name: 'idx_course_guide_topics_section_sort',
    });

    await queryInterface.addIndex('CourseGuideTopics', ['sectionId', 'topicKey'], {
      unique: true,
      name: 'uniq_course_guide_topics_section_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('CourseGuideTopics');
    await queryInterface.dropTable('CourseGuideSections');
  },
};
