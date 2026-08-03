'use strict';

/** 活動候補名單（額滿後依序轉正） */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('event_waitlist_entries', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      eventId: {
        // 必須與 events.id 型別一致（Sequelize 預設為 signed INTEGER，非 UNSIGNED）
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'events', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      studentName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      studentEmail: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'waiting',
      },
      promotedReservationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      promotedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('event_waitlist_entries', ['eventId'], {
      name: 'idx_event_waitlist_event_id',
    });
    await queryInterface.addIndex('event_waitlist_entries', ['studentId'], {
      name: 'idx_event_waitlist_student_id',
    });
    await queryInterface.addIndex('event_waitlist_entries', ['status'], {
      name: 'idx_event_waitlist_status',
    });
    await queryInterface.addIndex('event_waitlist_entries', ['eventId', 'status', 'createdAt'], {
      name: 'idx_event_waitlist_event_status_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('event_waitlist_entries');
  },
};
