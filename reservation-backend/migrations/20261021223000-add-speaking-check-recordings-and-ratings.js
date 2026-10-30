'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const responseCols = await queryInterface.describeTable('speaking_check_responses').catch(() => null);
    if (responseCols && !responseCols.client_features) {
      await queryInterface.addColumn('speaking_check_responses', 'client_features', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (responseCols && !responseCols.audio_path) {
      await queryInterface.addColumn('speaking_check_responses', 'audio_path', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (responseCols && !responseCols.audio_mime) {
      await queryInterface.addColumn('speaking_check_responses', 'audio_mime', {
        type: Sequelize.STRING(80),
        allowNull: true,
      });
    }

    const tables = await queryInterface.showAllTables();
    const names = tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name));
    if (!names.includes('speaking_check_ratings')) {
      await queryInterface.createTable('speaking_check_ratings', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        response_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'speaking_check_responses', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        host_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'speaking_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        fluency: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
        pronunciation_intelligibility: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
        grammar: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
        vocabulary: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
        task_achievement: { type: Sequelize.TINYINT.UNSIGNED, allowNull: true },
        comments: { type: Sequelize.TEXT, allowNull: true },
        rubric_version: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'speaking-check-v1' },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex('speaking_check_ratings', ['host_id'], { name: 'speaking_check_ratings_host' });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const names = tables.map((entry) => (typeof entry === 'string' ? entry : entry.tableName || entry.table_name));
    if (names.includes('speaking_check_ratings')) {
      await queryInterface.dropTable('speaking_check_ratings');
    }
    const responseCols = await queryInterface.describeTable('speaking_check_responses').catch(() => null);
    if (responseCols?.audio_mime) await queryInterface.removeColumn('speaking_check_responses', 'audio_mime');
    if (responseCols?.audio_path) await queryInterface.removeColumn('speaking_check_responses', 'audio_path');
    if (responseCols?.client_features) await queryInterface.removeColumn('speaking_check_responses', 'client_features');
  },
};
