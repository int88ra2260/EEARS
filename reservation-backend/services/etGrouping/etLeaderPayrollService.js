'use strict';

const { Op } = require('sequelize');
const ExcelJS = require('exceljs');
const {
  Teacher,
  Event,
  EtLeaderAttendance,
  EtLeaderPayProfile,
  EtEventGroupLeader,
} = require('../../models');
const { getEventWindow } = require('./etLeaderAttendanceService');
const { ENGLISH_TABLE_EVENT_TYPE_ALIASES } = require('../../utils/eventCapacity');

const PAYABLE_STATUSES = Object.freeze(['on_time', 'late', 'manual']);

const STATUS_NOTE = Object.freeze({
  on_time: '',
  late: '遲到',
  manual: '行政補登',
});

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function roundHours(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function parseYearMonth(yearMonth) {
  const raw = String(yearMonth || '').trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw Object.assign(new Error('請提供有效月份（YYYY-MM）'), {
      status: 400,
      code: 'INVALID_YEAR_MONTH',
    });
  }
  const [y, m] = raw.split('-').map(Number);
  if (m < 1 || m > 12) {
    throw Object.assign(new Error('請提供有效月份（YYYY-MM）'), {
      status: 400,
      code: 'INVALID_YEAR_MONTH',
    });
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthPadded = String(m).padStart(2, '0');
  return {
    yearMonth: `${y}-${monthPadded}`,
    dateFrom: `${y}-${monthPadded}-01`,
    dateTo: `${y}-${monthPadded}-${String(lastDay).padStart(2, '0')}`,
  };
}

function computeEventHours(event) {
  const window = getEventWindow(event);
  if (!window?.startAt || !window?.endAt) return 0;
  const ms = window.endAt.getTime() - window.startAt.getTime();
  if (ms <= 0) return 0;
  return roundHours(ms / (60 * 60 * 1000));
}

function serializeProfile(row, teacher = null) {
  const leader = teacher || row?.leader || null;
  return {
    leaderTeacherId: row?.leaderTeacherId ?? leader?.id ?? null,
    name: leader?.name || null,
    studentId: leader?.studentId || null,
    email: leader?.email || null,
    seniorityYears: roundHours(row?.seniorityYears ?? 0),
    hourlyRate: roundMoney(row?.hourlyRate ?? 0),
    note: row?.note || null,
    hasProfile: Boolean(row?.id),
  };
}

async function listPayProfiles() {
  const leaders = await Teacher.findAll({
    where: { role: 'leader' },
    attributes: ['id', 'name', 'studentId', 'email'],
    include: [
      {
        model: EtLeaderPayProfile,
        as: 'leaderPayProfile',
        required: false,
      },
    ],
    order: [['name', 'ASC'], ['id', 'ASC']],
  });

  return leaders.map((leader) => serializeProfile(leader.leaderPayProfile, leader));
}

async function upsertPayProfile(leaderTeacherId, { seniorityYears, hourlyRate, note } = {}) {
  const teacherId = Number(leaderTeacherId);
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw Object.assign(new Error('無效的 Leader'), { status: 400 });
  }

  const teacher = await Teacher.findByPk(teacherId, {
    attributes: ['id', 'name', 'studentId', 'email', 'role'],
  });
  if (!teacher) {
    throw Object.assign(new Error('找不到此帳號'), { status: 404 });
  }

  const years = toNumber(seniorityYears, NaN);
  const rate = toNumber(hourlyRate, NaN);
  if (!Number.isFinite(years) || years < 0 || years > 99) {
    throw Object.assign(new Error('年資須為 0–99 的數字'), { status: 400, code: 'INVALID_SENIORITY' });
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 999999) {
    throw Object.assign(new Error('時薪須為 0 以上的數字'), { status: 400, code: 'INVALID_HOURLY_RATE' });
  }

  const noteValue =
    note != null && String(note).trim() !== '' ? String(note).slice(0, 255) : null;

  const [row] = await EtLeaderPayProfile.findOrCreate({
    where: { leaderTeacherId: teacherId },
    defaults: {
      leaderTeacherId: teacherId,
      seniorityYears: roundHours(years),
      hourlyRate: roundMoney(rate),
      note: noteValue,
    },
  });

  await row.update({
    seniorityYears: roundHours(years),
    hourlyRate: roundMoney(rate),
    note: noteValue,
  });

  const reloaded = await EtLeaderPayProfile.findByPk(row.id, {
    include: [{ model: Teacher, as: 'leader', attributes: ['id', 'name', 'studentId', 'email'] }],
  });
  return serializeProfile(reloaded, reloaded.leader);
}

async function buildMonthlyPayroll({ yearMonth } = {}) {
  const { yearMonth: month, dateFrom, dateTo } = parseYearMonth(yearMonth);

  const events = await Event.findAll({
    where: {
      date: { [Op.between]: [dateFrom, dateTo] },
      eventType: { [Op.in]: ENGLISH_TABLE_EVENT_TYPE_ALIASES },
    },
    attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'eventType'],
    order: [['date', 'ASC'], ['startTime', 'ASC'], ['id', 'ASC']],
  });
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const eventIds = events.map((e) => e.id);

  if (!eventIds.length) {
    return {
      yearMonth: month,
      dateFrom,
      dateTo,
      rows: [],
      totals: { sessionCount: 0, hours: 0, amount: 0, leaderCount: 0 },
    };
  }

  const [attendances, assignments, profiles] = await Promise.all([
    EtLeaderAttendance.findAll({
      where: {
        eventId: { [Op.in]: eventIds },
        status: { [Op.in]: PAYABLE_STATUSES },
      },
      include: [
        {
          model: Teacher,
          as: 'leader',
          attributes: ['id', 'name', 'studentId', 'email'],
          required: false,
        },
      ],
      order: [['event_id', 'ASC'], ['leader_teacher_id', 'ASC']],
    }),
    EtEventGroupLeader.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      attributes: ['eventId', 'leaderTeacherId', 'groupLabel'],
    }),
    EtLeaderPayProfile.findAll(),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.leaderTeacherId, p]));
  const groupLabelMap = new Map();
  for (const a of assignments) {
    const key = `${a.eventId}:${a.leaderTeacherId}`;
    if (!groupLabelMap.has(key)) groupLabelMap.set(key, []);
    groupLabelMap.get(key).push(a.groupLabel);
  }

  const byLeader = new Map();

  for (const att of attendances) {
    const event = eventMap.get(att.eventId);
    if (!event) continue;
    const hours = computeEventHours(event);
    const profile = profileMap.get(att.leaderTeacherId);
    const hourlyRate = roundMoney(profile?.hourlyRate ?? 0);
    const seniorityYears = roundHours(profile?.seniorityYears ?? 0);
    const subtotal = roundMoney(hours * hourlyRate);
    const statusNote = STATUS_NOTE[att.status] || att.status;
    const adminNote = att.note || '';
    const remarkParts = [statusNote, adminNote].filter(Boolean);
    const groupLabels = groupLabelMap.get(`${att.eventId}:${att.leaderTeacherId}`) || [];

    const session = {
      eventId: event.id,
      eventName: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      groupLabels,
      hours,
      status: att.status,
      method: att.method,
      checkInAt: att.checkInAt,
      hourlyRate,
      subtotal,
      note: remarkParts.join('；') || null,
    };

    if (!byLeader.has(att.leaderTeacherId)) {
      byLeader.set(att.leaderTeacherId, {
        leaderTeacherId: att.leaderTeacherId,
        name: att.leader?.name || `Leader #${att.leaderTeacherId}`,
        studentId: att.leader?.studentId || null,
        email: att.leader?.email || null,
        seniorityYears,
        hourlyRate,
        profileNote: profile?.note || null,
        sessions: [],
        sessionCount: 0,
        hours: 0,
        subtotal: 0,
      });
    }

    const bucket = byLeader.get(att.leaderTeacherId);
    // Prefer current profile values (may update mid-month)
    bucket.seniorityYears = seniorityYears;
    bucket.hourlyRate = hourlyRate;
    bucket.profileNote = profile?.note || null;
    bucket.sessions.push(session);
    bucket.sessionCount += 1;
    bucket.hours = roundHours(bucket.hours + hours);
    bucket.subtotal = roundMoney(bucket.subtotal + subtotal);
  }

  const rows = Array.from(byLeader.values())
    .map((row) => ({
      ...row,
      yearMonth: month,
      note: [
        row.profileNote,
        row.hourlyRate <= 0 ? '尚未設定時薪' : null,
      ]
        .filter(Boolean)
        .join('；') || null,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-Hant'));

  const totals = rows.reduce(
    (acc, row) => {
      acc.sessionCount += row.sessionCount;
      acc.hours = roundHours(acc.hours + row.hours);
      acc.amount = roundMoney(acc.amount + row.subtotal);
      return acc;
    },
    { sessionCount: 0, hours: 0, amount: 0, leaderCount: 0 }
  );
  totals.leaderCount = rows.length;

  return { yearMonth: month, dateFrom, dateTo, rows, totals };
}

async function exportMonthlyPayrollExcel(res, { yearMonth } = {}) {
  const report = await buildMonthlyPayroll({ yearMonth });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EEARS';
  workbook.created = new Date();

  const summary = workbook.addWorksheet('月結彙總');
  summary.columns = [
    { header: '姓名', key: 'name', width: 16 },
    { header: '學號', key: 'studentId', width: 14 },
    { header: '年資', key: 'seniorityYears', width: 10 },
    { header: '月份', key: 'yearMonth', width: 10 },
    { header: '出席場次', key: 'sessionCount', width: 10 },
    { header: '時數', key: 'hours', width: 10 },
    { header: '時薪', key: 'hourlyRate', width: 10 },
    { header: '小計', key: 'subtotal', width: 12 },
    { header: '備註', key: 'note', width: 28 },
  ];
  for (const row of report.rows) {
    summary.addRow({
      name: row.name,
      studentId: row.studentId || '',
      seniorityYears: row.seniorityYears,
      yearMonth: row.yearMonth,
      sessionCount: row.sessionCount,
      hours: row.hours,
      hourlyRate: row.hourlyRate,
      subtotal: row.subtotal,
      note: row.note || '',
    });
  }
  summary.addRow({});
  summary.addRow({
    name: '合計',
    sessionCount: report.totals.sessionCount,
    hours: report.totals.hours,
    subtotal: report.totals.amount,
  });

  const detail = workbook.addWorksheet('場次明細');
  detail.columns = [
    { header: '姓名', key: 'name', width: 16 },
    { header: '學號', key: 'studentId', width: 14 },
    { header: '日期', key: 'date', width: 12 },
    { header: '活動', key: 'eventName', width: 28 },
    { header: '時間', key: 'time', width: 14 },
    { header: '組別', key: 'groups', width: 14 },
    { header: '出席', key: 'status', width: 10 },
    { header: '時數', key: 'hours', width: 8 },
    { header: '時薪', key: 'hourlyRate', width: 10 },
    { header: '小計', key: 'subtotal', width: 10 },
    { header: '備註', key: 'note', width: 24 },
  ];
  for (const row of report.rows) {
    for (const session of row.sessions) {
      detail.addRow({
        name: row.name,
        studentId: row.studentId || '',
        date: session.date,
        eventName: session.eventName,
        time: `${session.startTime || ''}${session.endTime ? `–${session.endTime}` : ''}`,
        groups: (session.groupLabels || []).join(', '),
        status: STATUS_NOTE[session.status] || session.status,
        hours: session.hours,
        hourlyRate: session.hourlyRate,
        subtotal: session.subtotal,
        note: session.note || '',
      });
    }
  }

  const filename = `et-leader-payroll-${report.yearMonth}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  return report;
}

module.exports = {
  PAYABLE_STATUSES,
  parseYearMonth,
  computeEventHours,
  listPayProfiles,
  upsertPayProfile,
  buildMonthlyPayroll,
  exportMonthlyPayrollExcel,
};
