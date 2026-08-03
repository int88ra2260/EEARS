'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        'WeeklyReports',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          issueKey: {
            type: Sequelize.STRING(32),
            allowNull: false,
            unique: true,
          },
          slug: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          title: {
            type: Sequelize.STRING(200),
            allowNull: false,
          },
          headline: {
            type: Sequelize.STRING(500),
            allowNull: true,
          },
          editorial: {
            type: Sequelize.TEXT('long'),
            allowNull: true,
          },
          learningTip: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          wordBridgeLevel: {
            type: Sequelize.STRING(8),
            allowNull: false,
            defaultValue: 'A2',
          },
          wordBridgeThemeIds: {
            type: Sequelize.JSON,
            allowNull: false,
          },
          status: {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: 'draft',
          },
          publishedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
          weekStart: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          weekEnd: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          createdBy: {
            type: Sequelize.INTEGER,
            allowNull: true,
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

      const now = new Date();
      await queryInterface.bulkInsert(
        'WeeklyReports',
        [
          {
            issueKey: '2026-W26',
            slug: '2026-w26',
            title: 'EEARS Weekly 第 26 期',
            headline: '本週一起練校園英語，並預約 English Table 與 English Club！',
            editorial:
              '歡迎來到英語中心週報。本週我們聚焦「校園生活」相關字彙，完成下方語彙挑戰後，不妨到活動預約頁看看本週尚有名額的場次。\n\n若你尚未填寫學期問卷，請先完成問卷再預約 English Table 或 English Club。',
            learningTip:
              '閱讀提示：遇到不熟悉的單字時，先猜測詞性與前後文，再查字典；每天花 5 分鐘複習本週挑戰用過的詞，記憶會更穩固。',
            wordBridgeLevel: 'A2',
            wordBridgeThemeIds: JSON.stringify([
              'a2-campus',
              'a2-homework',
              'a2-weekend',
              'a2-shopping',
            ]),
            status: 'published',
            publishedAt: now,
            weekStart: '2026-06-22',
            weekEnd: '2026-06-28',
            createdAt: now,
            updatedAt: now,
          },
        ],
        { transaction }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WeeklyReports');
  },
};
