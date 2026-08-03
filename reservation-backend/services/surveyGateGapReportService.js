/**
 * Phase C v1：已預約但未完成問卷（僅 reservations + ET/EC，不含候補／取消）
 */
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Reservation, Event, Semester, SurveySettings } = require('../models');
const {
  EVENT_TYPE_TO_SURVEY_KEY,
  resolveGateContext,
  hasCompletedForGateWithSemester,
  ruleTimeAllows,
} = require('./surveyGateService');
const { maskEmail } = require('../utils/piiMask');
const surveyModuleService = require('./surveyModuleService');

const ACTIVITY_TO_EVENT_TYPE = {
  ET: 'English Table',
  EC: 'English Club',
};

function normalizePagination(query = {}) {
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 200);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function mapActivityType(activityType) {
  const key = String(activityType || '').trim().toUpperCase();
  return ACTIVITY_TO_EVENT_TYPE[key] || null;
}

function parseRequiredQuery(query = {}) {
  if (query.semesterId == null || query.semesterId === '') {
    const err = new Error('semesterId 為必填');
    err.status = 400;
    throw err;
  }
  if (!query.activityType) {
    const err = new Error('activityType 為必填（ET 或 EC）');
    err.status = 400;
    throw err;
  }
  const activityType = String(query.activityType).trim().toUpperCase();
  const eventType = mapActivityType(activityType);
  if (!eventType) {
    const err = new Error('activityType 必須為 ET 或 EC');
    err.status = 400;
    throw err;
  }
  return {
    semesterId: Number(query.semesterId),
    activityType,
    eventType,
    eventId: query.eventId != null && query.eventId !== '' ? Number(query.eventId) : null,
    studentId: query.studentId ? String(query.studentId).trim() : null,
    studentName: query.studentName ? String(query.studentName).trim() : null,
    studentEmail: query.studentEmail ? String(query.studentEmail).trim() : null,
  };
}

function mergeEventScopeWhere(eventWhere, scopeWhere) {
  if (!scopeWhere || !Object.keys(scopeWhere).length) return eventWhere;
  const scopedTypes = scopeWhere.eventType;
  if (!scopedTypes) return eventWhere;
  const allowed = Array.isArray(scopedTypes) ? scopedTypes : [scopedTypes];
  if (!allowed.includes(eventWhere.eventType)) {
    return { ...eventWhere, eventType: { [Op.in]: [] } };
  }
  return eventWhere;
}

async function findLegacySurveySetting(eventType) {
  const allSurveySettings = await SurveySettings.findAll({ where: { isEnabled: true } });
  const surveyIdMapping = {
    survey_1: 'English Table',
    survey_2: 'English Club',
    english_table_feedback_114_1: 'English Table',
    english_club_feedback_114_1: 'English Club',
  };

  return allSurveySettings.find((setting) => {
    if (!setting.relatedEventTypes) {
      return surveyIdMapping[setting.surveyId] === eventType;
    }
    let relatedTypes;
    try {
      relatedTypes = Array.isArray(setting.relatedEventTypes)
        ? setting.relatedEventTypes
        : JSON.parse(setting.relatedEventTypes);
    } catch (_) {
      return surveyIdMapping[setting.surveyId] === eventType;
    }
    return relatedTypes.includes(eventType);
  });
}

async function resolveGateActionable(eventType) {
  const ctx = await resolveGateContext(eventType);
  const surveyKey = EVENT_TYPE_TO_SURVEY_KEY[eventType];

  if (ctx.mode === 'product') {
    const { rule } = ctx;
    if (!rule.isEnabled) {
      return { actionable: false, reason: 'rule_disabled', ctx, surveyKey, retakePolicy: null };
    }
    if (!rule.isRequired) {
      return { actionable: false, reason: 'rule_not_required', ctx, surveyKey, retakePolicy: null };
    }
    const time = ruleTimeAllows(rule);
    if (!time.ok) {
      return { actionable: false, reason: time.reason, ctx, surveyKey, retakePolicy: null };
    }
    return {
      actionable: true,
      reason: null,
      ctx,
      surveyKey: ctx.surveyKey,
      surveyId: ctx.survey.id,
      rule: ctx.rule,
      retakePolicy: rule.retakePolicy || 'once_ever',
      gateMode: 'product',
    };
  }

  const surveySetting = await findLegacySurveySetting(eventType);
  if (!surveySetting) {
    return { actionable: false, reason: 'no_legacy_survey_setting', ctx, surveyKey, retakePolicy: null, gateMode: 'legacy' };
  }
  if (!surveySetting.isEnabled) {
    return { actionable: false, reason: 'rule_disabled', ctx, surveyKey, retakePolicy: null, gateMode: 'legacy' };
  }
  if (!surveySetting.isRequired) {
    return { actionable: false, reason: 'rule_not_required', ctx, surveyKey, retakePolicy: null, gateMode: 'legacy' };
  }
  const now = new Date();
  if (surveySetting.startDate && new Date(surveySetting.startDate) > now) {
    return { actionable: false, reason: 'not_started', ctx, surveyKey, retakePolicy: null, gateMode: 'legacy' };
  }
  if (surveySetting.endDate && new Date(surveySetting.endDate) < now) {
    return { actionable: false, reason: 'ended', ctx, surveyKey, retakePolicy: null, gateMode: 'legacy' };
  }

  return {
    actionable: true,
    reason: null,
    ctx,
    surveyKey,
    surveyId: null,
    rule: null,
    retakePolicy: 'once_ever',
    gateMode: 'legacy',
  };
}

function buildGapRowKey(studentId, eventId, retakePolicy) {
  if (retakePolicy === 'once_per_event') {
    return `${studentId}::event::${eventId}`;
  }
  return `${studentId}::semester`;
}

function maskGapRowEmail(row) {
  const raw = row.studentEmail || '';
  return {
    ...row,
    studentEmail: raw ? maskEmail(raw) : null,
    studentEmailMasked: true,
  };
}

async function buildMetaAndGate(parsed, semester) {
  const warnings = [];
  const nullSemesterEventCount = await Event.count({
    where: { eventType: parsed.eventType, semesterId: null },
  });
  if (nullSemesterEventCount > 0) {
    warnings.push(
      `另有 ${nullSemesterEventCount} 筆 ${parsed.eventType} 活動的 semesterId 為 null，v1 未納入缺口計算。`
    );
  }

  const gate = await resolveGateActionable(parsed.eventType);
  const meta = {
    semesterId: parsed.semesterId,
    semesterCode: semester.code,
    activityType: parsed.activityType,
    eventType: parsed.eventType,
    surveyKey: gate.surveyKey || EVENT_TYPE_TO_SURVEY_KEY[parsed.eventType],
    surveyId: gate.surveyId || gate.ctx?.survey?.id || null,
    gateMode: gate.gateMode || gate.ctx?.mode || null,
    gateActive: gate.actionable,
    retakePolicy: gate.retakePolicy,
    completionSemesterUsed: semester.code,
    reason: gate.reason,
    warnings,
  };

  return { meta, gate, warnings };
}

async function fetchReservations(parsed, eventScopeWhere) {
  const reservationWhere = {};
  if (parsed.studentId) reservationWhere.studentId = parsed.studentId;
  if (parsed.studentName) reservationWhere.studentName = { [Op.like]: `%${parsed.studentName}%` };
  if (parsed.studentEmail) reservationWhere.studentEmail = { [Op.like]: `%${parsed.studentEmail}%` };

  let eventWhere = {
    eventType: parsed.eventType,
    semesterId: parsed.semesterId,
  };
  if (parsed.eventId) eventWhere.id = parsed.eventId;
  eventWhere = mergeEventScopeWhere(eventWhere, eventScopeWhere);

  return Reservation.findAll({
    where: reservationWhere,
    include: [
      {
        model: Event,
        required: true,
        where: eventWhere,
        attributes: ['id', 'name', 'date', 'eventType', 'semesterId'],
      },
    ],
    attributes: ['id', 'studentId', 'studentName', 'studentEmail', 'timestamp', 'eventId'],
    order: [['timestamp', 'DESC']],
  });
}

async function computeGapRows(reservations, gate, semesterCode) {
  const gapMap = new Map();
  let scanned = 0;

  for (const reservation of reservations) {
    scanned += 1;
    const event = reservation.Event;
    if (!event) continue;

    const completed = await hasCompletedForGateWithSemester({
      surveyId: gate.surveyId,
      surveyKey: gate.surveyKey,
      rule: gate.rule,
      studentId: reservation.studentId,
      eventId: event.id,
      semesterCode,
    });
    if (completed) continue;

    const key = buildGapRowKey(reservation.studentId, event.id, gate.retakePolicy);
    const ts = reservation.timestamp ? new Date(reservation.timestamp) : null;
    const existing = gapMap.get(key);
    if (!existing) {
      gapMap.set(key, {
        studentId: reservation.studentId,
        studentName: reservation.studentName,
        studentEmail: reservation.studentEmail,
        surveyKey: gate.surveyKey,
        surveyId: gate.surveyId,
        reservationCount: 1,
        latestReservedAt: ts ? ts.toISOString() : null,
        sampleEventId: event.id,
        sampleEventName: event.name,
        sampleEventDate: event.date,
        gapReason: 'survey_not_completed',
      });
      continue;
    }

    existing.reservationCount += 1;
    if (ts && (!existing.latestReservedAt || ts > new Date(existing.latestReservedAt))) {
      existing.latestReservedAt = ts.toISOString();
      existing.sampleEventId = event.id;
      existing.sampleEventName = event.name;
      existing.sampleEventDate = event.date;
    }
  }

  const rows = Array.from(gapMap.values()).sort((a, b) => {
    const ta = a.latestReservedAt || '';
    const tb = b.latestReservedAt || '';
    return tb.localeCompare(ta);
  });

  return { rows, scanned, gapCount: rows.length, distinctStudents: rows.length };
}

async function listSurveyGateGaps(query = {}) {
  const parsed = parseRequiredQuery(query);
  const semester = await Semester.findByPk(parsed.semesterId);
  if (!semester) {
    const err = new Error('找不到指定學期');
    err.status = 404;
    throw err;
  }

  const { meta, gate } = await buildMetaAndGate(parsed, semester);
  const { page, pageSize, offset } = normalizePagination(query);

  if (!gate.actionable) {
    return {
      meta,
      summary: {
        reservationRowsScanned: 0,
        distinctStudents: 0,
        gapCount: 0,
      },
      rows: [],
      pagination: { page, pageSize, total: 0, totalPages: 0 },
    };
  }

  const reservations = await fetchReservations(parsed, query.__eventScopeWhere);
  const { rows: allRows, scanned, gapCount, distinctStudents } = await computeGapRows(
    reservations,
    gate,
    semester.code
  );

  const total = allRows.length;
  const pageRows = allRows.slice(offset, offset + pageSize).map((row) => {
    const out = maskGapRowEmail(row);
    if (query.__forExport) {
      return { ...row, studentEmail: row.studentEmail || '', studentEmailMasked: false };
    }
    return out;
  });

  return {
    meta,
    summary: {
      reservationRowsScanned: scanned,
      distinctStudents,
      gapCount,
    },
    rows: pageRows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total ? Math.ceil(total / pageSize) : 0,
    },
  };
}

async function exportSurveyGateGapsXlsx(query, res, actorId) {
  const full = await listSurveyGateGaps({
    ...query,
    page: 1,
    pageSize: 10000,
    __forExport: true,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('survey_gate_gaps');
  ws.columns = [
    { header: 'semester', key: 'semester', width: 12 },
    { header: 'activityType', key: 'activityType', width: 12 },
    { header: 'surveyKey', key: 'surveyKey', width: 28 },
    { header: 'studentId', key: 'studentId', width: 14 },
    { header: 'studentName', key: 'studentName', width: 16 },
    { header: 'studentEmail', key: 'studentEmail', width: 28 },
    { header: 'reservationCount', key: 'reservationCount', width: 14 },
    { header: 'latestReservedAt', key: 'latestReservedAt', width: 22 },
    { header: 'sampleEventId', key: 'sampleEventId', width: 12 },
    { header: 'sampleEventName', key: 'sampleEventName', width: 24 },
    { header: 'sampleEventDate', key: 'sampleEventDate', width: 14 },
    { header: 'gateMode', key: 'gateMode', width: 12 },
    { header: 'retakePolicy', key: 'retakePolicy', width: 16 },
    { header: 'gapReason', key: 'gapReason', width: 22 },
  ];

  full.rows.forEach((r) => {
    ws.addRow({
      semester: full.meta.semesterCode,
      activityType: full.meta.activityType,
      surveyKey: r.surveyKey,
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      reservationCount: r.reservationCount,
      latestReservedAt: r.latestReservedAt,
      sampleEventId: r.sampleEventId,
      sampleEventName: r.sampleEventName,
      sampleEventDate: r.sampleEventDate,
      gateMode: full.meta.gateMode,
      retakePolicy: full.meta.retakePolicy,
      gapReason: r.gapReason,
    });
  });

  await surveyModuleService.writeAudit(
    actorId,
    'export',
    'SurveyGateGap',
    String(query.semesterId || ''),
    null,
    { count: full.rows.length, activityType: query.activityType },
    'export survey gate gaps xlsx'
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="survey-gate-gaps-export.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}

module.exports = {
  mapActivityType,
  parseRequiredQuery,
  listSurveyGateGaps,
  exportSurveyGateGapsXlsx,
};
