'use strict';



const dayjs = require('dayjs');

const { Op } = require('sequelize');

const { Event, Reservation } = require('../../models');

const { getGseSnapshotForStudent } = require('./etGseSnapshotService');

const { listBands, matchBandForSnapshot } = require('./etGroupingService');

const { calculateReservationTime } = require('../../utils/reservationTime');

const { getSemesterInfo } = require('../../utils/eventSemesterFromDate');



const SPEAKING_FOCUS_TYPES = ['English Table', 'English Club', 'International Forum'];



function identifyWeakSkillsFromSnapshot(snapshot) {

  if (!snapshot || snapshot.dataQuality === 'missing') return ['speaking'];

  const gse = snapshot.gse;

  if (gse != null && gse < 43) return ['speaking', 'listening'];

  if (gse != null && gse < 59) return ['speaking', 'writing'];

  return ['writing', 'speaking'];

}



function buildRationale({ eventType, matchedBand, weakSkills, openNow }) {

  const skills = weakSkills.join('、');

  const bandLabel = matchedBand?.label || '能力帶';

  if (!openNow) return `建議關注：${eventType}（${bandLabel}）；目前不在預約開放時間。`;

  return `口語／互動活動，對齊弱項（${skills}）與 ${bandLabel} 能力帶；可供學生自行預約。`;

}



async function getEtActivityRecommendations(studentId, { limit = 5 } = {}) {

  const sid = String(studentId || '').trim();

  if (!sid) throw Object.assign(new Error('請提供學號'), { status: 400 });



  const snapshot = await getGseSnapshotForStudent(sid);

  const bands = await listBands({ semesterId: null });

  const matchedBand = matchBandForSnapshot(snapshot, bands);

  const weakSkills = identifyWeakSkillsFromSnapshot(snapshot);



  const today = dayjs().format('YYYY-MM-DD');

  const events = await Event.findAll({

    where: {

      date: { [Op.gte]: today },

      eventType: { [Op.in]: SPEAKING_FOCUS_TYPES },

    },

    attributes: [

      'id', 'name', 'date', 'startTime', 'endTime', 'eventType',

      'maxCapacity', 'semesterId',

    ],

    order: [['date', 'ASC'], ['startTime', 'ASC']],

    limit: 40,

  });



  const participatedEventIds = new Set(

    (await Reservation.findAll({

      where: { studentId: sid },

      attributes: ['eventId'],

      raw: true,

    })).map((row) => row.eventId)

  );



  const now = dayjs();

  const recommendations = [];

  for (const event of events) {

    const { openStart, openEnd } = calculateReservationTime(event);

    const openNow = now.isAfter(openStart) && now.isBefore(openEnd);

    const reservedCount = await Reservation.count({ where: { eventId: event.id } });

    const availableSpots = Math.max(0, event.maxCapacity - reservedCount);

    const alreadyReserved = participatedEventIds.has(event.id);

    const priority = (event.eventType === 'English Table' ? 3 : 2)

      + (openNow ? 2 : 0)

      + (availableSpots > 0 ? 1 : 0)

      - (alreadyReserved ? 1 : 0);



    recommendations.push({

      eventId: event.id,

      name: event.name,

      date: event.date,

      startTime: event.startTime,

      eventType: event.eventType,

      semester: getSemesterInfo(event.date),

      matchedBandCode: matchedBand?.code || null,

      matchedBandLabel: matchedBand?.label || null,

      openNow,

      availableSpots,

      alreadyReserved,

      priority,

      rationale: buildRationale({

        eventType: event.eventType,

        matchedBand,

        weakSkills,

        openNow,

      }),

      adminEventPath: `/admin/operations/${event.id}`,

      publicEventsPath: '/events',

    });

  }



  return {

    studentId: sid,

    weakSkills,

    matchedBand: matchedBand ? { code: matchedBand.code, label: matchedBand.label } : null,

    gseSnapshot: snapshot,

    recommendations: recommendations

      .sort((a, b) => b.priority - a.priority)

      .slice(0, Math.max(1, Math.min(limit, 10))),

    disclaimer: '活動建議依 GSE 與弱項技能啟發式排序，僅供行政參考；學生預約仍須自行至活動頁完成。',

    causalClaimAllowed: false,

  };

}



module.exports = {

  getEtActivityRecommendations,

};

