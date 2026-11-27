'use strict';

const SKILLS = [
  ['listening', '聽力', [40, 40, 60]],
  ['reading', '閱讀', [20, 60, 60]],
  ['speaking', '口說', [80, 130, 150]],
  ['writing', '寫作', [80, 130, 150]],
];

function columnSpecs(Sequelize) {
  const columns = [];
  SKILLS.forEach(([key, label, marks]) => {
    columns.push({
      name: `${key}AchievementRate`,
      spec: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        comment: `${label}達成率（0-100）`,
      },
    });
    marks.forEach((max, index) => {
      const part = index + 1;
      columns.push({
        name: `${key}Part${part}Score`,
        spec: {
          type: Sequelize.DECIMAL(6, 2),
          allowNull: true,
          comment: `${label}第${part}部分分數（滿分 ${max}）`,
        },
      });
      columns.push({
        name: `${key}Part${part}Rate`,
        spec: {
          type: Sequelize.DECIMAL(5, 2),
          allowNull: true,
          comment: `${label}第${part}部分達成率（0-100）`,
        },
      });
    });
  });
  return columns;
}

async function columnExists(queryInterface, table, column) {
  const description = await queryInterface.describeTable(table);
  return Boolean(description[column]);
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const column of columnSpecs(Sequelize)) {
      if (await columnExists(queryInterface, 'bestep_exam_scores', column.name)) continue;
      await queryInterface.addColumn('bestep_exam_scores', column.name, column.spec);
    }
  },

  async down(queryInterface) {
    const names = columnSpecs({ DECIMAL: () => null }).map((column) => column.name).reverse();
    for (const name of names) {
      if (!(await columnExists(queryInterface, 'bestep_exam_scores', name))) continue;
      await queryInterface.removeColumn('bestep_exam_scores', name);
    }
  },
};
