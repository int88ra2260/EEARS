'use strict';

function legacyToBlocks(row) {
  const blocks = [];
  blocks.push({
    id: 'hero-1',
    type: 'hero',
    props: {
      kicker: 'EEARS Weekly',
      title: row.title || '',
      subtitle: row.headline || '',
      imageUrl: '',
      imageAlt: '',
    },
  });
  if (row.editorial) {
    const paragraphs = String(row.editorial)
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      .join('');
    blocks.push({
      id: 'richtext-1',
      type: 'richText',
      props: { html: paragraphs || `<p>${String(row.editorial)}</p>` },
    });
  }
  if (row.learningTip) {
    blocks.push({
      id: 'callout-1',
      type: 'callout',
      props: { variant: 'tip', title: '學習一點', body: row.learningTip },
    });
  }
  let themeIds = row.wordBridgeThemeIds;
  if (typeof themeIds === 'string') {
    try {
      themeIds = JSON.parse(themeIds);
    } catch {
      themeIds = [];
    }
  }
  if (!Array.isArray(themeIds)) themeIds = [];
  blocks.push({
    id: 'challenge-1',
    type: 'wordBridgeChallenge',
    props: {
      level: row.wordBridgeLevel || 'A2',
      themeIds,
    },
  });
  blocks.push({
    id: 'cta-1',
    type: 'cta',
    props: { label: '前往活動預約', href: '/events', variant: 'primary' },
  });
  return blocks;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'WeeklyReports',
        'blocks',
        { type: Sequelize.JSON, allowNull: true },
        { transaction }
      );
      await queryInterface.addColumn(
        'WeeklyReports',
        'blocksVersion',
        { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        { transaction }
      );

      await queryInterface.createTable(
        'WeeklyMedia',
        {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
          },
          originalName: {
            type: Sequelize.STRING(255),
            allowNull: false,
          },
          storedName: {
            type: Sequelize.STRING(255),
            allowNull: false,
            unique: true,
          },
          mimeType: {
            type: Sequelize.STRING(128),
            allowNull: false,
          },
          sizeBytes: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          urlPath: {
            type: Sequelize.STRING(500),
            allowNull: false,
          },
          alt: {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          uploadedBy: {
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

      const [rows] = await queryInterface.sequelize.query(
        'SELECT id, title, headline, editorial, learningTip, wordBridgeLevel, wordBridgeThemeIds FROM WeeklyReports',
        { transaction }
      );

      for (const row of rows) {
        const blocks = legacyToBlocks(row);
        await queryInterface.sequelize.query(
          'UPDATE WeeklyReports SET blocks = :blocks, blocksVersion = 1 WHERE id = :id',
          {
            replacements: { blocks: JSON.stringify(blocks), id: row.id },
            transaction,
          }
        );
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('WeeklyMedia');
    await queryInterface.removeColumn('WeeklyReports', 'blocksVersion');
    await queryInterface.removeColumn('WeeklyReports', 'blocks');
  },
};
