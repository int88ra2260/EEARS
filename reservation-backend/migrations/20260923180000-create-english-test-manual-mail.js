'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('english_test_mail_templates', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      subjectTemplate: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      bodyTemplate: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
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

    await queryInterface.createTable('english_test_mail_sends', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      batchId: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      registrationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      studentId: {
        type: Sequelize.STRING(32),
        allowNull: true,
      },
      studentName: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      sourceType: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: 'catalog | custom | adhoc',
      },
      versionLabel: {
        type: Sequelize.STRING(160),
        allowNull: false,
      },
      templateKey: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      customTemplateId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      errorMessage: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      sentByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.addIndex('english_test_mail_sends', ['sentAt'], {
      name: 'english_test_mail_sends_sent_at',
    });
    await queryInterface.addIndex('english_test_mail_sends', ['studentId'], {
      name: 'english_test_mail_sends_student_id',
    });
    await queryInterface.addIndex('english_test_mail_sends', ['registrationId'], {
      name: 'english_test_mail_sends_registration_id',
    });
    await queryInterface.addIndex('english_test_mail_sends', ['batchId'], {
      name: 'english_test_mail_sends_batch_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('english_test_mail_sends');
    await queryInterface.dropTable('english_test_mail_templates');
  },
};
