'use strict';

const TABLE = 'learning_trace_events';

async function indexExists(queryInterface, indexName) {
  const indexes = await queryInterface.showIndex(TABLE);
  return indexes.some((idx) => idx.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(TABLE, 'event_type', {
      type: Sequelize.ENUM(
        'session_start',
        'session_complete',
        'funnel_impression',
        'funnel_click',
        'funnel_book_attempt',
      ),
      allowNull: false,
    });

    if (await indexExists(queryInterface, 'learning_trace_events_trace_id_unique')) {
      await queryInterface.removeIndex(TABLE, 'learning_trace_events_trace_id_unique');
    }
    if (!(await indexExists(queryInterface, 'learning_trace_events_trace_event_unique'))) {
      await queryInterface.addIndex(TABLE, ['trace_id', 'event_type'], {
        unique: true,
        name: 'learning_trace_events_trace_event_unique',
      });
    }
  },

  async down(queryInterface, Sequelize) {
    if (await indexExists(queryInterface, 'learning_trace_events_trace_event_unique')) {
      await queryInterface.removeIndex(TABLE, 'learning_trace_events_trace_event_unique');
    }
    if (!(await indexExists(queryInterface, 'learning_trace_events_trace_id_unique'))) {
      await queryInterface.addIndex(TABLE, ['trace_id'], {
        unique: true,
        name: 'learning_trace_events_trace_id_unique',
      });
    }
    await queryInterface.changeColumn(TABLE, 'event_type', {
      type: Sequelize.ENUM('session_start', 'session_complete'),
      allowNull: false,
    });
  },
};
