'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 在 LeaderPublicProfiles 新增 isArchived 欄位
    await queryInterface.addColumn('LeaderPublicProfiles', 'isArchived', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // 2. 建立 LeaderSemesterAssignments 表
    await queryInterface.createTable('LeaderSemesterAssignments', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      leaderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'LeaderPublicProfiles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      semesterId: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: '學期代碼，如 114-1、114-2',
      },
      isPublished: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: '該學期是否顯示於前台',
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: '該學期的顯示排序',
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

    // 3. 建立唯一索引：同一 leader 在同一學期只能有一筆指派
    await queryInterface.addIndex('LeaderSemesterAssignments', ['leaderId', 'semesterId'], {
      unique: true,
      name: 'leader_semester_unique',
    });

    // 4. 建立查詢索引
    await queryInterface.addIndex('LeaderSemesterAssignments', ['semesterId', 'isPublished'], {
      name: 'semester_published_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LeaderSemesterAssignments');
    await queryInterface.removeColumn('LeaderPublicProfiles', 'isArchived');
  },
};
