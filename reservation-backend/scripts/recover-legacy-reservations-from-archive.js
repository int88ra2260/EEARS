'use strict';

/**
 * 從備份還原的 archive 表補匯 legacy 預約至 reservations。
 *
 * 使用時機：整併腳本已刪除 reservation 表，但預約尚未完整匯入時。
 *
 * 前置：
 * 1. 從資料庫備份還原下列其中一組來源表：
 *    - reservation_archive + event_archive（建議）
 *    - reservation + event（若你手動還原了舊表）
 * 2. events 表已包含對應活動（整併後 id 308+ 等）。
 *
 * 用法：
 *   node scripts/recover-legacy-reservations-from-archive.js --dry-run
 *   node scripts/recover-legacy-reservations-from-archive.js
 */

const sequelize = require('../db');
const {
  buildEventIdMap,
  importLegacyReservations,
} = require('../migrations/20260605120000-merge-legacy-event-reservation-tables');

async function resolveSources() {
  const [tables] = await sequelize.query(
    `
    SELECT TABLE_NAME AS name
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('reservation_archive', 'event_archive', 'reservation', 'event')
    `
  );
  const names = new Set(tables.map((row) => row.name));

  const reservationSource = names.has('reservation_archive')
    ? 'reservation_archive'
    : names.has('reservation')
      ? 'reservation'
      : null;
  const eventSource = names.has('event_archive')
    ? 'event_archive'
    : names.has('event')
      ? 'event'
      : null;

  return { reservationSource, eventSource };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await sequelize.authenticate();

  const { reservationSource, eventSource } = await resolveSources();
  if (!reservationSource || !eventSource) {
    throw new Error(
      '找不到來源表。請先還原 reservation_archive + event_archive（或 reservation + event）。'
    );
  }

  console.log(`來源：${eventSource} + ${reservationSource}`);
  console.log(dryRun ? '開始 DRY RUN…' : '開始補匯 legacy 預約…');

  const transaction = dryRun ? null : await sequelize.transaction();
  try {
    const [legacyEvents] = await sequelize.query(`SELECT * FROM \`${eventSource}\` ORDER BY id`, {
      transaction,
    });
    const [legacyReservations] = await sequelize.query(
      `SELECT * FROM \`${reservationSource}\` ORDER BY id`,
      { transaction }
    );

    const eventResult = await buildEventIdMap(sequelize, legacyEvents, transaction, {
      dryRun: false,
      insertMissing: false,
    });

    const reservationResult = await importLegacyReservations(
      sequelize,
      legacyReservations,
      eventResult.eventIdMap,
      transaction,
      { dryRun }
    );

    const summary = {
      dryRun,
      events: eventResult,
      reservations: reservationResult,
    };

    if (dryRun) {
      console.log('--- DRY RUN 摘要 ---');
    } else {
      await transaction.commit();
      console.log('--- 補匯完成 ---');
    }
    console.log(JSON.stringify(summary, null, 2));

    await sequelize.close();
  } catch (error) {
    if (transaction) await transaction.rollback();
    await sequelize.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error('❌ 失敗:', error.message);
  process.exit(1);
});
