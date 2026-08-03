'use strict';

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const {
  Event,
  EtEventGroupAssignment,
  EtEventGroupLeader,
} = require('../../models');
const { getSemesterInfo } = require('../../utils/eventSemesterFromDate');
const { resolveLegacyGroupCount } = require('../../utils/eventCapacity');
const { listGroupLeaders } = require('./etLeaderService');
const { buildPreferenceAssignmentsForEvent } = require('./etLeaderPreferenceService');
const etSessionTaskService = require('./etSessionTaskService');
const { computeTaskStatsFromMatrix } = require('./etGroupingExportService');

async function queryEtEvents({
  semesterId = null,
  semesterLabel = null,
  date = null,
  dateFrom = null,
  dateTo = null,
} = {}) {
  const where = { eventType: 'English Table' };
  if (date) {
    where.date = date;
  } else if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date[Op.gte] = dateFrom;
    if (dateTo) where.date[Op.lte] = dateTo;
  }

  let events = await Event.findAll({
    where,
    attributes: [
      'id', 'name', 'date', 'startTime', 'endTime', 'semesterId',
      'groupCount', 'perGroupCapacity', 'maxCapacity', 'groupingMode',
    ],
    order: [['date', 'ASC'], ['startTime', 'ASC'], ['id', 'ASC']],
  });

  if (semesterId != null) {
    events = events.filter((event) => event.semesterId === semesterId);
  } else if (semesterLabel && semesterLabel !== 'all') {
    events = events.filter((event) => getSemesterInfo(event.date) === semesterLabel);
  }

  return events;
}

async function buildEventReportRow(event) {
  const groupCount = resolveLegacyGroupCount(event);
  const [groupLeaders, assignments] = await Promise.all([
    listGroupLeaders(event.id),
    EtEventGroupAssignment.findAll({ where: { eventId: event.id } }),
  ]);

  const groupStatsMap = new Map();
  for (const assignment of assignments) {
    const label = assignment.groupLabel || '未分組';
    if (!groupStatsMap.has(label)) {
      groupStatsMap.set(label, { groupLabel: label, studentCount: 0, bandCode: assignment.bandCode });
    }
    groupStatsMap.get(label).studentCount += 1;
  }

  let taskStats = {
    checkedIn: 0,
    eligibleMarks: 0,
    completedMarks: 0,
    completionRate: null,
  };
  try {
    const matrix = await etSessionTaskService.getTaskMarksMatrix(event.id, {
      canManage: true,
      canMark: true,
    });
    taskStats = computeTaskStatsFromMatrix(matrix);
  } catch (_err) {
    // 無任務模板或尚未設定時略過
  }

  const preferenceAssignments = await buildPreferenceAssignmentsForEvent(event);

  return {
    eventId: event.id,
    name: event.name,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    semesterId: event.semesterId,
    groupingMode: event.groupingMode || 'legacy_sequential',
    groupCount,
    reservationCount: assignments.length,
    leaderCount: groupLeaders.filter((row) => row.leaderTeacherId).length,
    leaders: groupLeaders,
    groups: Array.from(groupStatsMap.values()).sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, 'zh-Hant')),
    taskStats,
    preferenceSlotCount: preferenceAssignments.length,
  };
}

async function getReportsSummary(filters = {}) {
  const events = await queryEtEvents(filters);
  const rows = await Promise.all(events.map((event) => buildEventReportRow(event)));
  return {
    filters,
    totalEvents: rows.length,
    events: rows,
  };
}

async function listLeaderManagementEvents(filters = {}) {
  const summary = await getReportsSummary(filters);
  return summary.events.map((row) => ({
    ...row,
    leaderFilled: row.leaderCount >= row.groupCount,
    canApplyPreferences: row.preferenceSlotCount > 0,
  }));
}

async function listMyLeaderSessions(teacherId, filters = {}) {
  if (!teacherId) return [];
  const leaderRows = await EtEventGroupLeader.findAll({
    where: { leaderTeacherId: teacherId },
    include: [{
      model: Event,
      as: 'event',
      required: true,
      attributes: [
        'id', 'name', 'date', 'startTime', 'endTime', 'semesterId', 'eventType',
      ],
    }],
    order: [[{ model: Event, as: 'event' }, 'date', 'DESC'], [{ model: Event, as: 'event' }, 'startTime', 'DESC']],
  });

  const eventMap = new Map();
  for (const row of leaderRows) {
    const event = row.event;
    if (!event || (event.eventType || 'English Table') !== 'English Table') continue;
    if (filters.semesterId != null && event.semesterId !== filters.semesterId) continue;
    if (filters.semesterLabel && filters.semesterLabel !== 'all'
      && getSemesterInfo(event.date) !== filters.semesterLabel) continue;
    if (!eventMap.has(event.id)) {
      eventMap.set(event.id, {
        eventId: event.id,
        name: event.name,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        semesterId: event.semesterId,
        groupLabels: [],
      });
    }
    eventMap.get(event.id).groupLabels.push(row.groupLabel);
  }

  return Array.from(eventMap.values()).map((item) => ({
    ...item,
    groupLabels: [...new Set(item.groupLabels)].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
  }));
}

async function writeReportsSummaryExcel(filters, res) {
  const summary = await getReportsSummary(filters);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ET場次彙總');
  sheet.columns = [
    { header: '活動ID', key: 'eventId', width: 10 },
    { header: '活動名稱', key: 'name', width: 24 },
    { header: '日期', key: 'date', width: 12 },
    { header: '開始', key: 'startTime', width: 10 },
    { header: '組數', key: 'groupCount', width: 8 },
    { header: '預約人數', key: 'reservationCount', width: 10 },
    { header: 'Leader已指派', key: 'leaderCount', width: 12 },
    { header: '已簽到', key: 'checkedIn', width: 8 },
    { header: '任務完成率%', key: 'completionRate', width: 14 },
    { header: '分組模式', key: 'groupingMode', width: 14 },
  ];

  for (const row of summary.events) {
    sheet.addRow({
      eventId: row.eventId,
      name: row.name,
      date: row.date,
      startTime: row.startTime,
      groupCount: row.groupCount,
      reservationCount: row.reservationCount,
      leaderCount: row.leaderCount,
      checkedIn: row.taskStats.checkedIn,
      completionRate: row.taskStats.completionRate ?? '',
      groupingMode: row.groupingMode,
    });
  }

  const filename = 'et-grouping-reports.xlsx';
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = {
  queryEtEvents,
  getReportsSummary,
  listLeaderManagementEvents,
  listMyLeaderSessions,
  writeReportsSummaryExcel,
  buildEventReportRow,
};
