'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const episodeTable = 'learning_growth_episodes';
    const bandTable = 'et_group_band_configs';
    const assignmentTable = 'et_event_group_assignments';
    const capsLevelsTable = 'learning_analytics_caps_levels';

    const renameEpisodeCol = async (from, to) => {
      const desc = await queryInterface.describeTable(episodeTable).catch(() => null);
      if (!desc || !desc[from]) return;
      if (desc[to]) return;
      await queryInterface.renameColumn(episodeTable, from, to);
    };

    await renameEpisodeCol('previous_caps', 'previous_gse');
    await renameEpisodeCol('post_caps', 'post_gse');
    await renameEpisodeCol('actual_caps_growth', 'actual_gse_growth');
    await renameEpisodeCol('expected_caps_growth', 'expected_gse_growth');
    await renameEpisodeCol('adjusted_caps_growth', 'adjusted_gse_growth');

    const episodeDesc = await queryInterface.describeTable(episodeTable).catch(() => ({}));
    for (const col of ['previous_gse', 'post_gse', 'actual_gse_growth', 'expected_gse_growth', 'adjusted_gse_growth']) {
      if (episodeDesc[col]) {
        await queryInterface.changeColumn(episodeTable, col, {
          type: Sequelize.DECIMAL(5, 1),
          allowNull: true,
        });
      }
    }

    if (episodeDesc.previous_gse) {
      await queryInterface.sequelize.query(
        `UPDATE ${episodeTable} SET previous_gse = NULL, post_gse = NULL, actual_gse_growth = NULL, expected_gse_growth = NULL, adjusted_gse_growth = NULL`
      );
    }

    const bandDesc = await queryInterface.describeTable(bandTable).catch(() => null);
    if (bandDesc?.caps_min && !bandDesc.gse_min) {
      await queryInterface.renameColumn(bandTable, 'caps_min', 'gse_min');
    }
    if (bandDesc?.caps_max && !bandDesc.gse_max) {
      await queryInterface.renameColumn(bandTable, 'caps_max', 'gse_max');
    }

    const assignDesc = await queryInterface.describeTable(assignmentTable).catch(() => null);
    if (assignDesc?.caps_snapshot && !assignDesc.gse_snapshot) {
      await queryInterface.renameColumn(assignmentTable, 'caps_snapshot', 'gse_snapshot');
    }
    if (assignDesc?.gse_snapshot) {
      await queryInterface.changeColumn(assignmentTable, 'gse_snapshot', {
        type: Sequelize.DECIMAL(5, 1),
        allowNull: true,
      });
      await queryInterface.sequelize.query(`UPDATE ${assignmentTable} SET gse_snapshot = NULL`);
    }

    const pearsonBands = [
      { code: 'ET-A2', gse_min: 22, gse_max: 42 },
      { code: 'ET-B1', gse_min: 43, gse_max: 58 },
      { code: 'ET-B2', gse_min: 59, gse_max: 75 },
      { code: 'ET-C1', gse_min: 76, gse_max: 90 },
      { code: 'ET-UNK', gse_min: null, gse_max: null },
    ];
    for (const band of pearsonBands) {
      await queryInterface.sequelize.query(
        `UPDATE ${bandTable} SET gse_min = :gse_min, gse_max = :gse_max WHERE code = :code`,
        { replacements: band }
      );
    }

    const capsTableExists = await queryInterface.describeTable(capsLevelsTable).catch(() => null);
    if (capsTableExists) {
      await queryInterface.dropTable(capsLevelsTable);
    }
  },

  async down(queryInterface, Sequelize) {
    const episodeTable = 'learning_growth_episodes';
    const bandTable = 'et_group_band_configs';
    const assignmentTable = 'et_event_group_assignments';
    const capsLevelsTable = 'learning_analytics_caps_levels';

    const renameBack = async (table, from, to) => {
      const desc = await queryInterface.describeTable(table).catch(() => null);
      if (!desc || !desc[from]) return;
      if (desc[to]) return;
      await queryInterface.renameColumn(table, from, to);
    };

    await renameBack(episodeTable, 'previous_gse', 'previous_caps');
    await renameBack(episodeTable, 'post_gse', 'post_caps');
    await renameBack(episodeTable, 'actual_gse_growth', 'actual_caps_growth');
    await renameBack(episodeTable, 'expected_gse_growth', 'expected_caps_growth');
    await renameBack(episodeTable, 'adjusted_gse_growth', 'adjusted_caps_growth');

    await renameBack(bandTable, 'gse_min', 'caps_min');
    await renameBack(bandTable, 'gse_max', 'caps_max');
    await renameBack(assignmentTable, 'gse_snapshot', 'caps_snapshot');

    const capsTableExists = await queryInterface.describeTable(capsLevelsTable).catch(() => null);
    if (!capsTableExists) {
      await queryInterface.createTable(capsLevelsTable, {
        id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        cefr: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        caps_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        updated_by: { type: Sequelize.STRING(80), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      });
    }
  },
};
