'use strict';

const { buildDefaultEnglishTestFormSchema } = require('../data/englishTestFormDefaultSchema');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('english_test_form_schemas', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      version: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'schema 版本號（每次儲存遞增）',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'published',
        comment: 'draft | published',
      },
      schemaJson: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: '表單 sections + questions + departmentOptions',
      },
      changeSummary: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: '最後更新的 User.id',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('english_test_form_schemas', ['status'], {
      name: 'idx_et_form_schema_status',
    });

    const tableDesc = await queryInterface.describeTable('english_test_registrations');
    if (!tableDesc.extraAnswers) {
      await queryInterface.addColumn('english_test_registrations', 'extraAnswers', {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '自訂題答案 { [fieldKey]: value }',
      });
    }

    const now = new Date();
    await queryInterface.bulkInsert('english_test_form_schemas', [
      {
        version: 1,
        status: 'published',
        schemaJson: JSON.stringify(buildDefaultEnglishTestFormSchema()),
        changeSummary: '初始種子：對應既有硬編碼報名表單',
        updatedBy: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('english_test_registrations').catch(() => null);
    if (tableDesc && tableDesc.extraAnswers) {
      await queryInterface.removeColumn('english_test_registrations', 'extraAnswers');
    }
    await queryInterface.dropTable('english_test_form_schemas');
  },
};
