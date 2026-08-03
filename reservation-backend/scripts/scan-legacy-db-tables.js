'use strict';

const sequelize = require('../db');
const fs = require('fs');
const path = require('path');

async function listDbTables() {
  const [rows] = await sequelize.query(`
    SELECT TABLE_NAME AS name, TABLE_ROWS AS rowEstimate, DATA_LENGTH AS dataBytes, INDEX_LENGTH AS indexBytes
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  return rows;
}

function listModelTableNames() {
  const modelsDir = path.join(__dirname, '..', 'models');
  const files = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.js') && f !== 'index.js');
  const tables = new Set();
  for (const file of files) {
    const content = fs.readFileSync(path.join(modelsDir, file), 'utf8');
    const m = content.match(/tableName:\s*['"]([^'"]+)['"]/);
    if (m) tables.add(m[1]);
  }
  return tables;
}

async function listForeignKeyTargets() {
  const [rows] = await sequelize.query(`
    SELECT DISTINCT REFERENCED_TABLE_NAME AS refTable, COUNT(DISTINCT TABLE_NAME) AS referencedBy
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
    GROUP BY REFERENCED_TABLE_NAME
  `);
  return new Map(rows.map((r) => [r.refTable, r.referencedBy]));
}

async function listIncomingFks(tableName) {
  const [rows] = await sequelize.query(
    `
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME = :tableName
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `,
    { replacements: { tableName } }
  );
  return rows;
}

async function listOutgoingFkCounts(tableName) {
  const [rows] = await sequelize.query(
    `
    SELECT COUNT(DISTINCT CONSTRAINT_NAME) AS cnt
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = :tableName
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `,
    { replacements: { tableName } }
  );
  return rows[0]?.cnt || 0;
}

async function main() {
  const modelTables = listModelTableNames();
  const dbTables = await listDbTables();
  const fkTargets = await listForeignKeyTargets();

  const knownLegacyPatterns = [
    /^event$/,
    /^reservation$/,
    /_archive$/,
    /_backup$/,
    /^Events$/,
    /^Reservations$/,
    /^Users$/,
  ];

  const candidates = [];

  for (const t of dbTables) {
    const inModels = modelTables.has(t.name);
    const referencedBy = fkTargets.get(t.name) || 0;
    const legacyPattern = knownLegacyPatterns.some((re) => re.test(t.name));
    const suspiciousSingular = !inModels && (t.name === t.name.toLowerCase()) && !t.name.includes('_');

    if (!inModels || legacyPattern) {
      const incoming = referencedBy > 0 ? await listIncomingFks(t.name) : [];
      const outgoingFks = await listOutgoingFkCounts(t.name);
      candidates.push({
        name: t.name,
        inModels,
        rowEstimate: t.rowEstimate,
        dataMB: Number(((t.dataBytes || 0) / 1024 / 1024).toFixed(2)),
        indexMB: Number(((t.indexBytes || 0) / 1024 / 1024).toFixed(2)),
        referencedBy,
        outgoingFks,
        incomingFks: incoming,
        legacyPattern,
        suspiciousSingular,
      });
    }
  }

  console.log('=== Model tableName 清單 ===');
  console.log([...modelTables].sort().join(', '));
  console.log(`\n=== 資料庫共 ${dbTables.length} 張表 ===`);
  console.log(`=== 非 Model / 疑似 legacy：${candidates.length} 張 ===\n`);

  for (const c of candidates.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(
      [
        c.name,
        `rows~${c.rowEstimate}`,
        `data=${c.dataMB}MB`,
        `idx=${c.indexMB}MB`,
        c.inModels ? 'in-model' : 'NO-MODEL',
        c.referencedBy ? `refBy=${c.referencedBy}` : 'refBy=0',
        c.outgoingFks ? `outFk=${c.outgoingFks}` : 'outFk=0',
        c.legacyPattern ? 'legacy-pattern' : '',
      ]
        .filter(Boolean)
        .join(' | ')
    );
    if (c.incomingFks.length) {
      for (const fk of c.incomingFks.slice(0, 5)) {
        console.log(`  <- ${fk.TABLE_NAME}.${fk.COLUMN_NAME} (${fk.CONSTRAINT_NAME})`);
      }
      if (c.incomingFks.length > 5) console.log(`  ... +${c.incomingFks.length - 5} more`);
    }
  }

  await sequelize.close();
}

main().catch(async (e) => {
  console.error(e);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
