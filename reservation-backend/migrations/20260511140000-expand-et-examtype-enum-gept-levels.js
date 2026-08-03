'use strict';

/**
 * 擴充 et_exam_attempts.examType ENUM：全民英檢等級別代碼（GEPT_A2 … GEPT_C2）
 */

function parseEnumValues(typeText) {
  const m = String(typeText || '').match(/^enum\((.+)\)$/i);
  if (!m) return null;
  const body = m[1];
  const values = [];
  const re = /'([^']*)'/g;
  let hit = re.exec(body);
  while (hit) {
    values.push(String(hit[1] || ''));
    hit = re.exec(body);
  }
  return values;
}

function toSqlEnum(values) {
  return values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
}

module.exports = {
  async up(queryInterface) {
    const tableName = 'et_exam_attempts';
    const columnName = 'examType';

    const table = await queryInterface.describeTable(tableName).catch(() => null);
    if (!table || !table[columnName]) return;

    const col = table[columnName];
    const enumValues = parseEnumValues(col.type);
    if (!enumValues) return;

    const targetValues = ['GEPT_A2', 'GEPT_B1', 'GEPT_B2', 'GEPT_C1', 'GEPT_C2'];
    const currentSet = new Set(enumValues.map((x) => String(x).toUpperCase()));
    const needAdd = targetValues.filter((x) => !currentSet.has(x));
    if (!needAdd.length) return;

    const nextValues = [...enumValues, ...needAdd];
    const enumSql = toSqlEnum(nextValues);
    const nullSql = col.allowNull ? 'NULL' : 'NOT NULL';
    const defaultSql = col.defaultValue == null
      ? ''
      : ` DEFAULT '${String(col.defaultValue).replace(/'/g, "''")}'`;

    await queryInterface.sequelize.query(
      `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ENUM(${enumSql}) ${nullSql}${defaultSql};`
    );
  },

  async down() {
    // 不回退 enum 值
  }
};
