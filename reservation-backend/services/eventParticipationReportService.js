const { Reservation, Event } = require('../models');
const { canAccessEventType } = require('../auth/accessProfile');
const { getSemesterInfo } = require('../utils/eventSemesterFromDate');
const { compareSemester } = require('../utils/semesterConstants');
const eventTypeService = require('./eventTypeService');

function eventTypeSortKey(t) {
  const cfg = eventTypeService.resolveTypeConfigSync(t, { fallbackDefault: false });
  if (cfg && Number.isFinite(Number(cfg.sortOrder))) return Number(cfg.sortOrder);
  return 1000;
}

/**
 * 各學期 × 活動類型：已簽到預約的「不重複學號人數」與「簽到人次」（筆數）。
 * @param {{ user: object, eventScopeWhere?: object }} opts
 */
async function getParticipationCheckinBySemesterAndType({ user, eventScopeWhere }) {
  await eventTypeService.refreshCatalogCache();
  const rows = await Reservation.findAll({
    where: { checkinStatus: '已簽到' },
    include: [
      {
        model: Event,
        required: true,
        attributes: ['id', 'date', 'eventType'],
        where: eventScopeWhere,
      },
    ],
    attributes: ['id', 'studentId'],
  });

  /** @type {Map<string, { studentIds: Set<string>, checkinVisits: number }>} */
  const cells = new Map();

  for (const r of rows) {
    const ev = r.Event;
    if (!ev || !ev.date) continue;
    const eventType = eventTypeService.coerceEventTypeCode(ev.eventType);
    if (user && user.role === 'teacher' && !canAccessEventType(user, eventType)) {
      continue;
    }
    const semester = getSemesterInfo(ev.date);
    const key = `${semester}\t${eventType}`;
    if (!cells.has(key)) {
      cells.set(key, { studentIds: new Set(), checkinVisits: 0 });
    }
    const cell = cells.get(key);
    if (r.studentId != null && String(r.studentId).trim() !== '') {
      cell.studentIds.add(String(r.studentId).trim());
    }
    cell.checkinVisits += 1;
  }

  const out = [];
  for (const [key, cell] of cells.entries()) {
    const [semester, eventType] = key.split('\t');
    out.push({
      semester,
      eventType,
      uniqueParticipants: cell.studentIds.size,
      checkinVisits: cell.checkinVisits,
    });
  }

  out.sort((a, b) => {
    const c = compareSemester(a.semester, b.semester);
    if (c !== 0) return c;
    const ta = eventTypeSortKey(a.eventType);
    const tb = eventTypeSortKey(b.eventType);
    if (ta !== tb) return ta - tb;
    return String(a.eventType).localeCompare(String(b.eventType), 'zh-Hant');
  });

  return {
    rows: out,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getParticipationCheckinBySemesterAndType,
};
