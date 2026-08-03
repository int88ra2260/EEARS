'use strict';

const { sortStudentsForAbility } = require('./etPhysicalGroupAssignment');

const UNK_BAND_CODE = 'ET-UNK';

function buildGroupLabel(band, tableIndex) {
  const count = band.tableCount || 1;
  if (count <= 1) return band.code;
  return `${band.code}-${tableIndex}`;
}

function assignStudentsToTables(students, band) {
  const tableCount = Math.max(1, band.tableCount || 1);
  const maxPerTable = Math.max(1, band.maxPerTable || 12);
  const tableLoads = Array(tableCount).fill(0);
  const results = [];

  for (const student of students) {
    let placed = false;
    for (let offset = 0; offset < tableCount; offset += 1) {
      const tableIdx = (results.length + offset) % tableCount;
      if (tableLoads[tableIdx] < maxPerTable) {
        tableLoads[tableIdx] += 1;
        results.push({
          ...student,
          bandCode: band.code,
          groupLabel: buildGroupLabel(band, tableIdx + 1),
        });
        placed = true;
        break;
      }
    }
    if (!placed) {
      results.push({
        ...student,
        bandCode: band.code,
        groupLabel: `${band.code}-overflow`,
      });
    }
  }
  return results;
}

function buildAssignmentRow({ eventId, item, groupLabel, source, bandCode }) {
  return {
    eventId,
    reservationId: item.reservation.id,
    studentId: item.reservation.studentId,
    bandCode: bandCode || item.band?.code || null,
    groupLabel,
    gseSnapshot: item.snapshot?.gse ?? null,
    cefrSnapshot: item.snapshot?.cefr ?? null,
    dataQuality: item.snapshot?.dataQuality || 'missing',
    source,
    leaderTeacherId: null,
    adjustedBy: null,
    adjustedAt: null,
    adjustReason: null,
  };
}

function countBandTables(bands = []) {
  return bands
    .filter((band) => band.isActive !== false && band.code !== UNK_BAND_CODE)
    .reduce((sum, band) => sum + Math.max(1, Number(band.tableCount) || 1), 0);
}

/**
 * 依能力帶設定（含每帶多桌）產生分組結果，組別標籤如 ET-B1-1。
 */
function buildBandTableAssignments({ eventId, students = [], bands = [] }) {
  const activeBands = bands.filter((band) => band.isActive !== false);
  const byBandCode = new Map();
  for (const item of students) {
    const code = item.band?.code || UNK_BAND_CODE;
    if (!byBandCode.has(code)) byBandCode.set(code, []);
    byBandCode.get(code).push(item);
  }

  const assignments = [];
  for (const band of activeBands) {
    const items = byBandCode.get(band.code) || [];
    if (!items.length) continue;
    const sorted = sortStudentsForAbility(items);
    const placed = assignStudentsToTables(sorted, band);
    for (const row of placed) {
      assignments.push(buildAssignmentRow({
        eventId,
        item: row,
        groupLabel: row.groupLabel,
        source: 'auto',
        bandCode: row.bandCode,
      }));
    }
    byBandCode.delete(band.code);
  }

  const unkBand = activeBands.find((band) => band.code === UNK_BAND_CODE)
    || { code: UNK_BAND_CODE, tableCount: 1, maxPerTable: 12 };
  const remaining = [];
  for (const items of byBandCode.values()) {
    remaining.push(...items);
  }
  if (remaining.length) {
    const sorted = remaining.slice().sort((a, b) => a.reservation.id - b.reservation.id);
    const placed = assignStudentsToTables(sorted, unkBand);
    for (const row of placed) {
      assignments.push(buildAssignmentRow({
        eventId,
        item: row,
        groupLabel: row.groupLabel,
        source: 'auto',
        bandCode: row.bandCode,
      }));
    }
  }

  return assignments;
}

module.exports = {
  UNK_BAND_CODE,
  buildBandTableAssignments,
  countBandTables,
  assignStudentsToTables,
  buildGroupLabel,
};
