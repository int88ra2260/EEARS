/* eslint-disable no-console */
/**
 * EWL（英文寫作工坊）ReservationInfo → activity_participations
 *
 * 活動日取 EventDate（非報名日 ReservationDate）。
 *
 * 範例：
 *   node scripts/sync-ewl-reservations.js --dryRun
 *   node scripts/sync-ewl-reservations.js --startDate=2024-12-01 --endDate=2024-12-31 --apply
 *   node scripts/sync-ewl-reservations.js --studentId=B132025012 --apply --rebuild
 *   node scripts/sync-ewl-reservations.js --startDate=2024-01-01 --endDate=2026-12-31 --apply --rebuild
 */
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../models');
const { syncEwlReservations } = require('../services/learningJourney/ewlSyncService');

function parseArg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  if (!hit) return null;
  return hit.slice(prefix.length).trim();
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = !argv.includes('--apply');
  const rebuild = argv.includes('--rebuild') || argv.includes('--rebuildAnalytics');
  const startDate = parseArg('startDate');
  const endDate = parseArg('endDate');
  const studentId = parseArg('studentId');
  const lookbackDays = parseArg('lookbackDays');
  const lookaheadDays = parseArg('lookaheadDays');

  if ((startDate && !endDate) || (!startDate && endDate)) {
    console.error('startDate 與 endDate 需同時提供');
    process.exit(1);
  }

  console.log(JSON.stringify({
    dryRun,
    rebuild,
    startDate: startDate || null,
    endDate: endDate || null,
    studentId: studentId || null
  }, null, 2));

  let data;
  try {
    data = await syncEwlReservations({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      studentId: studentId || undefined,
      dryRun,
      rebuildAnalytics: !dryRun && rebuild,
      lookbackDays: lookbackDays != null ? Number(lookbackDays) : undefined,
      lookaheadDays: lookaheadDays != null ? Number(lookaheadDays) : undefined
    });
  } catch (e) {
    console.error('[ewl-sync] 執行失敗', e);
    process.exit(1);
  }

  const summary = {
    ...data,
    affectedStudentIds: undefined,
    affectedStudentCount: data.affectedStudentCount
  };
  console.log(JSON.stringify(summary, null, 2));
  await sequelize.close().catch(() => {});
  process.exit(data.errorCount > 0 ? 2 : 0);
}

main();
