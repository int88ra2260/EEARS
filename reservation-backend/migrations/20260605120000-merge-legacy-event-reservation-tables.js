'use strict';

/**
 * 整併 legacy `event` / `reservation` 至現行 `events` / `reservations`，並刪除舊表與重複 FK。
 *
 * 策略：
 * 1. 先建立 event_archive / reservation_archive 備份表（若尚不存在）。
 * 2. 依活動內容對應既有 events；找不到則 INSERT（含 semesterId）。
 * 3. 將 legacy reservation 依對應後的 eventId 匯入 reservations。
 * 4. 移除 reservation 表上所有重複 FK，刪除 reservation、event 舊表。
 *
 * 執行前請先備份資料庫。down() 不提供自動還原。
 */

function getInsertId(queryResult) {
  if (Number.isInteger(queryResult)) return queryResult;
  if (queryResult && Number.isInteger(queryResult.insertId)) return queryResult.insertId;
  throw new Error(`INSERT 未取得 insertId: ${JSON.stringify(queryResult)}`);
}

function assertEventIdMapComplete(eventIdMap, legacyEventIds) {
  const missing = legacyEventIds.filter((id) => !Number.isInteger(eventIdMap.get(id)));
  if (missing.length > 0) {
    throw new Error(
      `活動 ID 對應不完整（${missing.length} 筆），範例 legacy ids: ${missing.slice(0, 10).join(', ')}`
    );
  }
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

async function archiveLegacyTable(sequelize, sourceTable, archiveTable, transaction) {
  const [exists] = await sequelize.query(
    `
    SELECT COUNT(*) AS cnt
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :archiveTable
    `,
    { replacements: { archiveTable }, transaction }
  );
  if (exists[0].cnt > 0) {
    console.log(`⚠️  ${archiveTable} 已存在，略過備份`);
    return false;
  }
  await sequelize.query(`CREATE TABLE \`${archiveTable}\` AS SELECT * FROM \`${sourceTable}\``, {
    transaction,
  });
  console.log(`✅ 已備份 ${sourceTable} → ${archiveTable}`);
  return true;
}

async function listForeignKeyNames(sequelize, tableName, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT kcu.CONSTRAINT_NAME AS name
    FROM information_schema.KEY_COLUMN_USAGE kcu
    INNER JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
      AND tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
      AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = :tableName
    `,
    { replacements: { tableName }, transaction }
  );
  return rows.map((row) => row.name);
}

async function dropAllForeignKeys(queryInterface, sequelize, tableName, transaction) {
  const names = await listForeignKeyNames(sequelize, tableName, transaction);
  for (const name of names) {
    await queryInterface.removeConstraint(tableName, name, { transaction });
    console.log(`✅ 已移除 ${tableName} 外鍵 ${name}`);
  }
  return names.length;
}

async function resolveSemesterId(sequelize, dateStr, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT id
    FROM semesters
    WHERE :eventDate >= startDate AND :eventDate <= endDate
    ORDER BY id
    LIMIT 1
    `,
    { replacements: { eventDate: dateStr }, transaction }
  );
  return rows[0]?.id ?? null;
}

async function findMatchingEventId(sequelize, legacyEvent, transaction) {
  const [rows] = await sequelize.query(
    `
    SELECT id
    FROM events
    WHERE TRIM(name) = TRIM(:name)
      AND date = :date
      AND startTime = :startTime
      AND endTime = :endTime
      AND maxCapacity = :maxCapacity
      AND IFNULL(eventType, '') = IFNULL(:eventType, '')
    LIMIT 1
    `,
    { replacements: legacyEvent, transaction }
  );
  return rows[0]?.id ?? null;
}

async function buildEventIdMap(
  sequelize,
  legacyEvents,
  transaction,
  { dryRun = false, insertMissing = true } = {}
) {
  const eventIdMap = new Map();
  let matched = 0;
  let inserted = 0;

  for (const legacyEvent of legacyEvents) {
    const existingId = await findMatchingEventId(sequelize, legacyEvent, transaction);
    if (existingId) {
      eventIdMap.set(legacyEvent.id, existingId);
      matched += 1;
      continue;
    }

    if (!insertMissing) {
      throw new Error(
        `找不到 events 對應活動（legacy event id=${legacyEvent.id}, date=${legacyEvent.date}）`
      );
    }

    if (dryRun) {
      eventIdMap.set(legacyEvent.id, -1);
      inserted += 1;
      continue;
    }

    const semesterId = await resolveSemesterId(sequelize, legacyEvent.date, transaction);
    const [result] = await sequelize.query(
      `
      INSERT INTO events (
        name, date, startTime, endTime, maxCapacity, eventType,
        customReservationRule, location, autoCheckCompleted, semesterId
      ) VALUES (
        TRIM(:name), :date, :startTime, :endTime, :maxCapacity, :eventType,
        :customReservationRule, :location, :autoCheckCompleted, :semesterId
      )
      `,
      {
        replacements: {
          name: legacyEvent.name,
          date: legacyEvent.date,
          startTime: legacyEvent.startTime,
          endTime: legacyEvent.endTime,
          maxCapacity: legacyEvent.maxCapacity,
          eventType: legacyEvent.eventType,
          customReservationRule: legacyEvent.customReservationRule,
          location: legacyEvent.location,
          autoCheckCompleted: legacyEvent.autoCheckCompleted,
          semesterId,
        },
        transaction,
      }
    );

    eventIdMap.set(legacyEvent.id, getInsertId(result));
    inserted += 1;
  }

  return { eventIdMap, matched, inserted, legacyCount: legacyEvents.length };
}

async function importLegacyReservations(sequelize, legacyReservations, eventIdMap, transaction, {
  dryRun = false,
} = {}) {
  if (!dryRun) {
    assertEventIdMapComplete(eventIdMap, [...eventIdMap.keys()]);
  }

  let imported = 0;
  let skipped = 0;
  let unmapped = 0;

  for (const row of legacyReservations) {
    const mappedEventId = eventIdMap.get(row.eventId);
    if (!Number.isInteger(mappedEventId) || mappedEventId < 1) {
      unmapped += 1;
      continue;
    }

    const [existing] = await sequelize.query(
      `
      SELECT id
      FROM reservations
      WHERE eventId = :eventId
        AND (studentId = :studentId OR studentEmail = :studentEmail)
      LIMIT 1
      `,
      {
        replacements: {
          eventId: mappedEventId,
          studentId: row.studentId,
          studentEmail: row.studentEmail,
        },
        transaction,
      }
    );

    if (existing.length > 0) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      imported += 1;
      continue;
    }

    await sequelize.query(
      `
      INSERT INTO reservations (
        studentId, studentName, studentEmail, timestamp, eventId, userId,
        checkinStatus, checkinTime, \`group\`, cancellationCode
      ) VALUES (
        :studentId, :studentName, :studentEmail, :timestamp, :eventId, :userId,
        :checkinStatus, :checkinTime, :group, NULL
      )
      `,
      {
        replacements: {
          studentId: row.studentId,
          studentName: row.studentName,
          studentEmail: row.studentEmail,
          timestamp: row.timestamp,
          eventId: mappedEventId,
          userId: row.userId,
          checkinStatus: row.checkinStatus,
          checkinTime: row.checkinTime,
          group: row.group,
        },
        transaction,
      }
    );
    imported += 1;
  }

  if (!dryRun && unmapped > 0) {
    throw new Error(`有 ${unmapped} 筆 legacy reservation 無法對應 eventId，已中止以避免資料遺失`);
  }

  return { imported, skipped, unmapped, legacyCount: legacyReservations.length };
}

async function mergeLegacyTables(queryInterface, { dryRun = false, eventSource = 'event', reservationSource = 'reservation' } = {}) {
  const dialect = queryInterface.sequelize.getDialect();
  if (dialect !== 'mysql') {
    console.log('非 MySQL，略過 legacy event/reservation 整併');
    return null;
  }

  const sequelize = queryInterface.sequelize;
  const hasEvent = await tableExists(queryInterface, eventSource);
  const hasReservation = await tableExists(queryInterface, reservationSource);

  if (!hasEvent && !hasReservation) {
    console.log('✅ legacy event/reservation 來源表已不存在，略過');
    return { alreadyDone: true };
  }

  const transaction = dryRun ? null : await sequelize.transaction();

  try {
    if (!dryRun && hasEvent && eventSource === 'event') {
      await archiveLegacyTable(sequelize, 'event', 'event_archive', transaction);
    }
    if (!dryRun && hasReservation && reservationSource === 'reservation') {
      await archiveLegacyTable(sequelize, 'reservation', 'reservation_archive', transaction);
    }

    const eventResult = hasEvent
      ? await buildEventIdMap(
          sequelize,
          (await sequelize.query(`SELECT * FROM \`${eventSource}\` ORDER BY id`, { transaction }))[0],
          transaction,
          { dryRun }
        )
      : { eventIdMap: new Map(), matched: 0, inserted: 0, legacyCount: 0 };

    const reservationResult = hasReservation
      ? await importLegacyReservations(
          sequelize,
          (await sequelize.query(`SELECT * FROM \`${reservationSource}\` ORDER BY id`, { transaction }))[0],
          eventResult.eventIdMap,
          transaction,
          { dryRun }
        )
      : { imported: 0, skipped: 0, unmapped: 0, legacyCount: 0 };

    let removedReservationFks = 0;
    if (hasReservation && !dryRun && reservationSource === 'reservation') {
      removedReservationFks = await dropAllForeignKeys(
        queryInterface,
        sequelize,
        'reservation',
        transaction
      );
      await queryInterface.dropTable('reservation', { transaction });
      console.log('✅ 已刪除 legacy reservation 表');
    } else if (hasReservation && dryRun && reservationSource === 'reservation') {
      removedReservationFks = (await listForeignKeyNames(sequelize, 'reservation', transaction)).length;
    }

    if (hasEvent && !dryRun && eventSource === 'event') {
      await queryInterface.dropTable('event', { transaction });
      console.log('✅ 已刪除 legacy event 表');
    }

    const summary = {
      dryRun,
      eventSource,
      reservationSource,
      events: {
        legacyRows: eventResult.legacyCount,
        matchedExisting: eventResult.matched,
        inserted: eventResult.inserted,
      },
      reservations: {
        legacyRows: reservationResult.legacyCount,
        imported: reservationResult.imported,
        skippedDuplicates: reservationResult.skipped,
        unmappedEventId: reservationResult.unmapped,
      },
      removedReservationForeignKeys: removedReservationFks,
      droppedLegacyTables: dryRun
        ? []
        : [
            hasReservation && reservationSource === 'reservation' ? 'reservation' : null,
            hasEvent && eventSource === 'event' ? 'event' : null,
          ].filter(Boolean),
    };

    if (dryRun) {
      console.log('--- DRY RUN 摘要 ---');
    } else {
      await transaction.commit();
      console.log('--- 整併完成 ---');
    }
    console.log(JSON.stringify(summary, null, 2));

    return summary;
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
}

module.exports = {
  async up(queryInterface) {
    await mergeLegacyTables(queryInterface, { dryRun: false });
  },

  async down() {
    console.log('legacy event/reservation 整併不提供自動 down；請從備份還原。');
  },

  mergeLegacyTables,
  buildEventIdMap,
  importLegacyReservations,
  findMatchingEventId,
  getInsertId,
};
