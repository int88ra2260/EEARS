'use strict';



const { Op } = require('sequelize');

const {

  Reservation,

  Event,

  EtEventGroupAssignment,

  EtSessionTaskMark,

} = require('../../models');

const { getGseSnapshotForStudent } = require('./etGseSnapshotService');

const { listTaskTemplate } = require('./etTaskTemplateService');

const { filterTasksForBand } = require('./etTaskScope');



async function countTaskCompletion(eventId, reservationId, bandCode, semesterId) {

  const [marks, templateData] = await Promise.all([

    EtSessionTaskMark.findAll({

      where: { eventId, reservationId, completed: true },

      attributes: ['id'],

    }),

    listTaskTemplate({ semesterId }),

  ]);

  const applicable = filterTasksForBand(templateData.items || [], bandCode);

  const total = applicable.length;

  const completed = marks.length;

  return {

    completed,

    total,

    rate: total > 0 ? Math.round((completed / total) * 1000) / 10 : null,

  };

}



async function getStudentEtInsights(studentId) {

  const sid = String(studentId || '').trim();

  if (!sid) throw Object.assign(new Error('請提供學號'), { status: 400 });



  const reservations = await Reservation.findAll({

    where: { studentId: sid },

    include: [{

      model: Event,

      required: true,

      where: { eventType: 'English Table' },

      attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'semesterId', 'groupingMode'],

    }],

    order: [[{ model: Event }, 'date', 'DESC'], ['id', 'DESC']],

    limit: 30,

  });



  const sessions = [];

  let checkedInCount = 0;

  let completionSum = 0;

  let completionCount = 0;



  for (const reservation of reservations) {

    const event = reservation.Event;

    const assignment = await EtEventGroupAssignment.findOne({

      where: { eventId: event.id, reservationId: reservation.id },

    });

    const taskStats = await countTaskCompletion(

      event.id,

      reservation.id,

      assignment?.bandCode || null,

      event.semesterId

    );

    if ((reservation.checkinStatus || '未簽到') === '已簽到') checkedInCount += 1;

    if (taskStats.rate != null) {

      completionSum += taskStats.rate;

      completionCount += 1;

    }

    sessions.push({

      eventId: event.id,

      eventName: event.name,

      date: event.date,

      startTime: event.startTime,

      groupingMode: event.groupingMode || 'legacy_sequential',

      checkinStatus: reservation.checkinStatus || '未簽到',

      groupLabel: reservation.group || assignment?.groupLabel || null,

      bandCode: assignment?.bandCode || null,

      gseSnapshot: assignment?.gseSnapshot ?? null,

      cefrSnapshot: assignment?.cefrSnapshot ?? null,

      taskCompleted: taskStats.completed,

      taskTotal: taskStats.total,

      taskCompletionRate: taskStats.rate,

      adminEventPath: `/admin/operations/${event.id}`,

    });

  }



  const gseSnapshot = await getGseSnapshotForStudent(sid);



  return {

    studentId: sid,

    gseSnapshot,

    summary: {

      totalSessions: sessions.length,

      checkedInCount,

      avgTaskCompletionRate: completionCount

        ? Math.round((completionSum / completionCount) * 10) / 10

        : null,

    },

    sessions,

    links: {

      learningJourney: `/admin/learning-journey/students/${encodeURIComponent(sid)}`,

      learningAnalytics: `/admin/learning-analytics/students/${encodeURIComponent(sid)}`,

      etStudentTrends: `/admin/et-grouping/student-trends?studentId=${encodeURIComponent(sid)}`,

    },

    disclaimer: 'ET 參與與任務完成為觀察紀錄；GSE 為內部分析分數，非官方英檢成績。',

  };

}



module.exports = {

  getStudentEtInsights,

};

