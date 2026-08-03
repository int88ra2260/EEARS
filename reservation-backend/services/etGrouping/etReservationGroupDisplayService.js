'use strict';

const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');

const DEFAULT_GROUP_COUNT = 9;

/**
 * 舊制：依預約順序平均分配到活動設定的組數
 */
function buildLegacySequentialGroups(reservations = [], { groupCount = DEFAULT_GROUP_COUNT } = {}) {
  const totalStudents = reservations.length;
  const totalGroups = Math.max(1, resolveLegacyGroupCount({ groupCount }));
  const baseGroupSize = Math.floor(totalStudents / totalGroups);
  const remainder = totalStudents % totalGroups;
  const groupSizes = Array(totalGroups).fill(baseGroupSize);
  for (let i = 0; i < remainder; i += 1) {
    groupSizes[i] += 1;
  }

  let currentGroup = 1;
  let studentsInCurrentGroup = 0;

  return reservations.map((reservation) => {
    if (studentsInCurrentGroup >= groupSizes[currentGroup - 1]) {
      currentGroup += 1;
      studentsInCurrentGroup = 0;
    }
    studentsInCurrentGroup += 1;
    return {
      reservation,
      group: reservation.group || `Group ${currentGroup}`,
    };
  });
}

function mapReservationRow(reservation, group) {
  return {
    id: reservation.id,
    studentId: reservation.studentId,
    studentName: reservation.studentName,
    studentEmail: reservation.studentEmail,
    timestamp: reservation.timestamp,
    checkinStatus: reservation.checkinStatus || '未簽到',
    checkinTime: reservation.checkinTime,
    group,
  };
}

/**
 * 依活動分組模式產生名單顯示用組別
 */
async function buildReservationGroupsForDisplay(event, reservations = [], { assignmentMap } = {}) {
  const eventType = event.eventType || 'English Table';
  if (eventType !== 'English Table') {
    return reservations.map((r) => mapReservationRow(r, null));
  }

  const useAbility = event.groupingMode === 'ability' && assignmentMap && assignmentMap.size > 0;
  if (useAbility) {
    return reservations.map((r) => {
      const assignment = assignmentMap.get(r.id);
      const group = r.group || assignment?.groupLabel || null;
      return mapReservationRow(r, group);
    });
  }

  return buildLegacySequentialGroups(reservations, {
    groupCount: event.groupCount,
  }).map(({ reservation, group }) =>
    mapReservationRow(reservation, group)
  );
}

module.exports = {
  DEFAULT_GROUP_COUNT,
  buildLegacySequentialGroups,
  buildReservationGroupsForDisplay,
};
