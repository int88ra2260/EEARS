'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('learning_journey_operation_runs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      operation_type: {
        type: Sequelize.STRING(64),
        allowNull: false
      },
      semester_id: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'running'
      },
      request_id: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      executed_by_user_id: {
        type: Sequelize.STRING(64),
        allowNull: true
      },
      executed_by_username: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      finished_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration_ms: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },
      source: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'api'
      },
      dry_run: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      confirm: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      before_summary: {
        type: Sequelize.JSON,
        allowNull: true
      },
      after_summary: {
        type: Sequelize.JSON,
        allowNull: true
      },
      diff_summary: {
        type: Sequelize.JSON,
        allowNull: true
      },
      result_summary: {
        type: Sequelize.JSON,
        allowNull: true
      },
      warnings: {
        type: Sequelize.JSON,
        allowNull: true
      },
      error_code: {
        type: Sequelize.STRING(80),
        allowNull: true
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('learning_journey_operation_runs', ['semester_id'], {
      name: 'idx_lj_operation_runs_semester'
    });
    await queryInterface.addIndex('learning_journey_operation_runs', ['operation_type'], {
      name: 'idx_lj_operation_runs_type'
    });
    await queryInterface.addIndex('learning_journey_operation_runs', ['status'], {
      name: 'idx_lj_operation_runs_status'
    });
    await queryInterface.addIndex('learning_journey_operation_runs', ['request_id'], {
      name: 'idx_lj_operation_runs_request'
    });
    await queryInterface.addIndex('learning_journey_operation_runs', ['started_at'], {
      name: 'idx_lj_operation_runs_started'
    });
    await queryInterface.addIndex('learning_journey_operation_runs', ['executed_by_user_id'], {
      name: 'idx_lj_operation_runs_user'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('learning_journey_operation_runs');
  }
};
