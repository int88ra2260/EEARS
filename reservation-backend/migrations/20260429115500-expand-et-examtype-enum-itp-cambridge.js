'use strict';

/**
 * 擴充 et_exam_attempts.examType ENUM：
 * - 新增 TOEFL_ITP
 * - 新增 CAMBRIDGE
 *
 * 設計原則：
 * 1) 僅在 examType 為 ENUM 欄位時執行
 * 2) 已包含目標值時不重複修改（idempotent）
 * 3) down 不移除 enum 值（避免既有資料失敗）
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
    if (!enumValues) {
      // 非 ENUM（例如 VARCHAR）環境：不需要 migration
      return;
    }

    const targetValues = ['TOEFL_ITP', 'CAMBRIDGE'];
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
    // 故意不回退 enum 值，避免資料中已存在新值時 migration down 失敗。
  }
};

