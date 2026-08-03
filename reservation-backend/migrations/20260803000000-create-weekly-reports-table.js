'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weekly_reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '年份',
      },
      week: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: '週數',
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: '週報標題',
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: '週報起始日期',
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: '週報結束日期',
      },
      content: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: '週報內容 (Markdown)',
      },
      status: {
        type: Sequelize.ENUM('draft', 'pending', 'published'),
        defaultValue: 'draft',
        allowNull: false,
        comment: '狀態：草稿/待審核/已發布',
      },
      created_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '建立者',
      },
      updated_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: '更新者',
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: '發布時間',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('weekly_reports', ['year', 'week'], {
      unique: true,
      name: 'idx_weekly_reports_year_week',
    });

    await queryInterface.addIndex('weekly_reports', ['status'], {
      name: 'idx_weekly_reports_status',
    });

    await queryInterface.addIndex('weekly_reports', ['start_date', 'end_date'], {
      name: 'idx_weekly_reports_date_range',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('weekly_reports');
  },
};
