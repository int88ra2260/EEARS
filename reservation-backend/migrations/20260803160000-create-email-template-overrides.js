'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_template_overrides', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      templateKey: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
      },
      subjectTemplate: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'null = 使用程式預設主旨；支援 {{var}}',
      },
      bodyTemplate: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'null = 使用程式預設正文；支援 {{var}}',
      },
      isEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      notes: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      updatedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_template_overrides');
  },
};
