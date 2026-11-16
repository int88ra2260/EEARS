'use strict';

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await columnExists(queryInterface, 'trip_count_expenses', 'category'))) {
      await queryInterface.addColumn('trip_count_expenses', 'category', {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_count_expenses', 'spent_on'))) {
      await queryInterface.addColumn('trip_count_expenses', 'spent_on', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_count_shares', 'weight'))) {
      await queryInterface.addColumn('trip_count_shares', 'weight', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    // 舊版 weights 把份數暫存在 share_cents；搬到 weight 後清掉金額欄
    await queryInterface.sequelize.query(`
      UPDATE trip_count_shares AS share
      INNER JOIN trip_count_expenses AS expense
        ON expense.id = share.expense_id
      SET
        share.weight = share.share_cents,
        share.share_cents = NULL
      WHERE expense.split_mode = 'weights'
        AND share.share_cents IS NOT NULL
        AND share.weight IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE trip_count_shares AS share
      INNER JOIN trip_count_expenses AS expense
        ON expense.id = share.expense_id
      SET share.share_cents = share.weight
      WHERE expense.split_mode = 'weights'
        AND share.weight IS NOT NULL
    `);

    if (await columnExists(queryInterface, 'trip_count_shares', 'weight')) {
      await queryInterface.removeColumn('trip_count_shares', 'weight');
    }
    if (await columnExists(queryInterface, 'trip_count_expenses', 'spent_on')) {
      await queryInterface.removeColumn('trip_count_expenses', 'spent_on');
    }
    if (await columnExists(queryInterface, 'trip_count_expenses', 'category')) {
      await queryInterface.removeColumn('trip_count_expenses', 'category');
    }
  },
};
