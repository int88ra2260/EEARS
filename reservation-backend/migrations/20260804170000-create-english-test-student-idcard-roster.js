'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('english_test_student_idcard_roster_uploads', {
      id: { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
      fileNameOriginal: { type: Sequelize.STRING(260), allowNull: false, defaultValue: '' },
      storedFileUrl: { type: Sequelize.STRING(500), allowNull: true },
      rowCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      validCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      conflictCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('english_test_student_idcard_roster_entries', {
      studentId: { type: Sequelize.STRING(50), allowNull: false, primaryKey: true },
      idNumber: { type: Sequelize.STRING(10), allowNull: false },
      nameZh: { type: Sequelize.STRING(50), allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('english_test_student_idcard_roster_entries');
    await queryInterface.dropTable('english_test_student_idcard_roster_uploads');
  },
};

