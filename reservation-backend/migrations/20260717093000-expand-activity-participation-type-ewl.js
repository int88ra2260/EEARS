'use strict';

/**
 * 擴充 activity_participations.activity_type ENUM：新增 EWL（英文寫作工坊）
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
    const tableName = 'activity_participations';
    const columnName = 'activity_type';

    const table = await queryInterface.describeTable(tableName).catch(() => null);
    if (!table || !table[columnName]) return;

    const col = table[columnName];
    const enumValues = parseEnumValues(col.type);
    if (!enumValues) return;

    const currentSet = new Set(enumValues.map((x) => String(x).toUpperCase()));
    if (currentSet.has('EWL')) return;

    const nextValues = [...enumValues, 'EWL'];
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
    // 不回退 enum 值（避免既有 EWL 列無法寫入）
  }
};
