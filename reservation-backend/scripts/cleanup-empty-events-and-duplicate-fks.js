'use strict';

/**
 * 1. 刪除整併失敗產生、無任何關聯資料的空活動（id >= 308）。
 * 2. 清理重複外鍵，每個欄位只保留一個正確 FK。
 *
 * 用法：
 *   node scripts/cleanup-empty-events-and-duplicate-fks.js --dry-run
 *   node scripts/cleanup-empty-events-and-duplicate-fks.js
 */

const sequelize = require('../db');

const EMPTY_EVENT_MIN_ID = 308;

const FK_TARGETS = [
  {
    tableName: 'blacklist_records',
    columnName: 'userId',
    refTable: 'users',
    refColumn: 'id',
    keepName: 'blacklist_records_userId_users_fk',
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  {
    tableName: 'reservations',
    columnName: 'userId',
    refTable: 'users',
    refColumn: 'id',
    keepName: 'reservations_userId_users_fk',
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  },
  {
    tableName: 'event_violations',
    columnName: 'eventId',
    refTable: 'events',
    refColumn: 'id',
    keepName: 'event_violations_eventId_events_fk',
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
];

async function listColumnForeignKeys(sequelize, tableName, columnName, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT kcu.CONSTRAINT_NAME AS name,
      kcu.REFERENCED_TABLE_NAME AS refTable,
      kcu.REFERENCED_COLUMN_NAME AS refColumn,
      rc.UPDATE_RULE AS updateRule,
      rc.DELETE_RULE AS deleteRule
    FROM information_schema.KEY_COLUMN_USAGE kcu
    INNER JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
      AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = :tableName
      AND kcu.COLUMN_NAME = :columnName
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.CONSTRAINT_NAME
    `,
    { replacements: { tableName, columnName }, transaction }
  );
  return rows;
}

async function findOrphanEmptyEvents(sequelize, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT e.id, e.name, e.date
    FROM events e
    WHERE e.id >= :minId
      AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.eventId = e.id)
      AND NOT EXISTS (SELECT 1 FROM event_violations v WHERE v.eventId = e.id)
      AND NOT EXISTS (SELECT 1 FROM event_waitlist_entries w WHERE w.eventId = e.id)
      AND NOT EXISTS (SELECT 1 FROM survey_responses s WHERE s.eventId = e.id)
    ORDER BY e.id
    `,
    { replacements: { minId: EMPTY_EVENT_MIN_ID }, transaction }
  );
  return rows;
}

async function deleteOrphanEmptyEvents(queryInterface, sequelize, { dryRun = false, transaction } = {}) {
  const orphans = await findOrphanEmptyEvents(sequelize, transaction);
  if (orphans.length === 0) {
    return { deleted: 0, ids: [] };
  }

  const ids = orphans.map((row) => row.id);
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}DELETE ${orphans.length} empty events (id >= ${EMPTY_EVENT_MIN_ID}): ${ids[0]}..${ids[ids.length - 1]}`
  );

  if (!dryRun) {
    await sequelize.query(
      `
      DELETE FROM events
      WHERE id >= :minId
        AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.eventId = events.id)
        AND NOT EXISTS (SELECT 1 FROM event_violations v WHERE v.eventId = events.id)
        AND NOT EXISTS (SELECT 1 FROM event_waitlist_entries w WHERE w.eventId = events.id)
        AND NOT EXISTS (SELECT 1 FROM survey_responses s WHERE s.eventId = events.id)
      `,
      { replacements: { minId: EMPTY_EVENT_MIN_ID }, transaction }
    );
  }

  return { deleted: orphans.length, ids };
}

async function normalizeColumnForeignKey(
  queryInterface,
  sequelize,
  target,
  { dryRun = false, transaction } = {}
) {
  const fks = await listColumnForeignKeys(sequelize, target.tableName, target.columnName, transaction);
  const matching = fks.filter(
    (fk) => fk.refTable.toLowerCase() === target.refTable.toLowerCase()
  );

  const keepExisting = matching.find((fk) => fk.name === target.keepName);
  const ruleSource = keepExisting || matching[0] || target;
  const onUpdate = ruleSource.updateRule || target.onUpdate;
  const onDelete = ruleSource.deleteRule || target.onDelete;

  let removeNames;
  if (matching.length === 0) {
    removeNames = [];
  } else if (matching.length === 1 && keepExisting) {
    removeNames = [];
  } else {
    removeNames = matching.map((fk) => fk.name);
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}${target.tableName}.${target.columnName}: ${matching.length} FK(s) -> ${target.refTable}, remove ${removeNames.length}, keep ${target.keepName}`
  );

  if (dryRun) {
    return {
      tableName: target.tableName,
      columnName: target.columnName,
      before: matching.length,
      removed: removeNames.length,
      after: matching.length > 0 ? 1 : 1,
    };
  }

  for (const name of removeNames) {
    await queryInterface.removeConstraint(target.tableName, name, { transaction });
  }

  const remaining = await listColumnForeignKeys(
    sequelize,
    target.tableName,
    target.columnName,
    transaction
  );
  const hasCanonical = remaining.some((fk) => fk.name === target.keepName);

  if (!hasCanonical) {
    await queryInterface.addConstraint(
      target.tableName,
      {
        fields: [target.columnName],
        type: 'foreign key',
        name: target.keepName,
        references: { table: target.refTable, field: target.refColumn },
        onUpdate,
        onDelete,
      },
      { transaction }
    );
  }

  const after = await listColumnForeignKeys(
    sequelize,
    target.tableName,
    target.columnName,
    transaction
  );

  return {
    tableName: target.tableName,
    columnName: target.columnName,
    before: matching.length,
    removed: removeNames.length,
    after: after.length,
    keepName: target.keepName,
  };
}

async function cleanupEmptyEventsAndDuplicateFks({ dryRun = false } = {}) {
  if (sequelize.getDialect() !== 'mysql') {
    console.log('非 MySQL，略過');
    return null;
  }

  const queryInterface = sequelize.getQueryInterface();
  const transaction = dryRun ? null : await sequelize.transaction();

  try {
    const events = await deleteOrphanEmptyEvents(queryInterface, sequelize, {
      dryRun,
      transaction,
    });

    const fkResults = [];
    for (const target of FK_TARGETS) {
      fkResults.push(
        await normalizeColumnForeignKey(queryInterface, sequelize, target, {
          dryRun,
          transaction,
        })
      );
    }

    const summary = { dryRun, events, foreignKeys: fkResults };

    if (dryRun) {
      console.log('\n--- DRY RUN 摘要 ---');
    } else {
      await transaction.commit();
      console.log('\n--- 清理完成 ---');
    }
    console.log(JSON.stringify(summary, null, 2));

    return summary;
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await sequelize.authenticate();
  console.log(dryRun ? '開始 DRY RUN…' : '開始清理空活動與重複 FK…');
  await cleanupEmptyEventsAndDuplicateFks({ dryRun });
  await sequelize.close();
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error('❌ 失敗:', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
}

module.exports = { cleanupEmptyEventsAndDuplicateFks, FK_TARGETS, EMPTY_EVENT_MIN_ID };
