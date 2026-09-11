'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const reservationCols = await queryInterface.describeTable('reservations').catch(() => null);
    if (reservationCols && !reservationCols.counts_toward_passport) {
      await queryInterface.addColumn('reservations', 'counts_toward_passport', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: '學生聲明此預約要累計英語實踐歷程護照點數（與課堂加分擇一）',
      });
    }
    if (reservationCols && !reservationCols.passport_points_status) {
      await queryInterface.addColumn('reservations', 'passport_points_status', {
        type: Sequelize.STRING(32),
        allowNull: true,
        comment: 'null|pending|granted|blocked_limit|failed — 護照點數發放狀態',
      });
    }
    if (reservationCols && !reservationCols.passport_submission_id) {
      await queryInterface.addColumn('reservations', 'passport_submission_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: '對應 english_learning_submissions.id（已入點時）',
      });
    }

    const rules = await queryInterface.describeTable('english_learning_point_rules').catch(() => null);
    if (rules) {
      await queryInterface.sequelize.query(
        `
        UPDATE english_learning_point_rules
        SET
          name = :name,
          description = :description,
          max_points_total = 60,
          updated_at = CURRENT_TIMESTAMP
        WHERE code = 'SELF_LEARNING_ACTIVITY'
        `,
        {
          replacements: {
            name: '英語增能活動',
            description: 'EEARS 活動簽到或相關增能活動，每次 5 點，最多 12 次共 60 點',
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const reservationCols = await queryInterface.describeTable('reservations').catch(() => null);
    if (reservationCols?.passport_submission_id) {
      await queryInterface.removeColumn('reservations', 'passport_submission_id');
    }
    if (reservationCols?.passport_points_status) {
      await queryInterface.removeColumn('reservations', 'passport_points_status');
    }
    if (reservationCols?.counts_toward_passport) {
      await queryInterface.removeColumn('reservations', 'counts_toward_passport');
    }

    const rules = await queryInterface.describeTable('english_learning_point_rules').catch(() => null);
    if (rules) {
      await queryInterface.sequelize.query(
        `
        UPDATE english_learning_point_rules
        SET
          name = :name,
          description = :description,
          max_points_total = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE code = 'SELF_LEARNING_ACTIVITY'
        `,
        {
          replacements: {
            name: '英語自學園活動',
            description: '自學園、西灣沙龍、英語寫作工作坊，每次 5 點',
          },
        },
      );
    }
  },
};
