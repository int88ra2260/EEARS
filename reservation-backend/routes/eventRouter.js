// routes/eventRouter.js
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs'); // 匯出 Excel
const {
  authMiddleware,
  adminOrExecutiveMiddleware,
  requirePermission,
  requireAnyPermission,
  requirePermissionAndEventAccess,
  hasPermission,
  P,
  canAccessEventType,
} = require('../middlewares/auth');
const { Event, Reservation, User, EventViolation } = require('../models');
const { requirePasswordConfirmation } = require('../middlewares/requirePasswordConfirmation');
const { Op } = require('sequelize');
const { createAPIError, logError } = require('../utils/errorMessages');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');
const { getMultipleEventsCheckinStats } = require('../utils/eventStats');
const { getSemesterInfo } = require('../utils/eventSemesterFromDate');
const { filterEventsByDateQuery } = require('../utils/eventDateFilter');
const eventParticipationReportService = require('../services/eventParticipationReportService');
const { runEventAutoCheck } = require('../services/eventAutoCheckService');
const { checkSurvey } = require('../middlewares/checkSurvey');
const waitlistService = require('../services/waitlistService');
const { getPublishedAssignmentMap } = require('../services/etGrouping/etGroupingService');
const { buildReservationGroupsForDisplay } = require('../services/etGrouping/etReservationGroupDisplayService');
const { normalizeEventCapacityInput, formatCapacityPayload } = require('../utils/eventCapacity');
const {
  assertCanAccessEvent,
  buildEventScopeWhere,
} = require('../services/accessControl/eventScopeGuard');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

async function loadEventForAccess(req, res, next) {
  try {
    const event = await Event.findByPk(req.params.id, {
      attributes: ['id', 'eventType', 'date', 'name', 'autoCheckCompleted'],
    });
    if (!event) return res.status(404).json({ error: '活動不存在' });
    req.accessEvent = event;
    next();
  } catch (err) {
    next(err);
  }
}

function accessEventType(req) {
  return req.accessEvent?.eventType || req.query?.eventType || req.body?.eventType;
}

function sendScopeDenied(res, err) {
  return res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'EVENT_SCOPE_DENIED',
    message: err.message || '您沒有存取此活動資料的權限。',
  });
}

function buildScopedEventQuery(req, res) {
  const eventScopeWhere = buildEventScopeWhere(req.user);
  if (eventScopeWhere === null) {
    res.status(403).json({
      success: false,
      errorCode: 'MISSING_EVENT_CONTEXT',
      message: '此操作需要指定活動或班級資料來源。',
    });
    return null;
  }
  return eventScopeWhere;
}

function normalizeLocation(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

const DEFAULT_EVENT_NOTES = '實踐歷程檔案';

/** @param {unknown} value @param {{ useDefault?: boolean }} [opts] */
function normalizeNotes(value, opts = {}) {
  const { useDefault = false } = opts;
  if (value === undefined || value === null) {
    return useDefault ? DEFAULT_EVENT_NOTES : null;
  }
  if (typeof value !== 'string') {
    return useDefault ? DEFAULT_EVENT_NOTES : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return useDefault ? DEFAULT_EVENT_NOTES : null;
  return trimmed.slice(0, 255);
}

// 1) GET /api/events - 前台取得全部活動 (無需 Token)
router.get('/events', async (req, res, next) => {
  try {
    const events = await Event.findAll();
    
    // 使用共用函數取得準確的預約統計
    const eventIds = events.map(e => e.id);
    const checkinStatsMap = await getMultipleEventsCheckinStats(eventIds);
    
    const result = events.map(e => {
      // 使用共用函數取得的統計結果（從資料庫直接查詢，最準確）
      const stats = checkinStatsMap.get(e.id) || {
        totalReservations: 0,
        checkedIn: 0,
        notCheckedIn: 0,
        violations: 0
      };
      const reservedCount = Math.max(0, parseInt(stats.totalReservations) || 0);
      const maxCapacity = Math.max(0, parseInt(e.maxCapacity) || 0);
      const availableSpots = Math.max(0, maxCapacity - reservedCount);
      
      return {
        id: e.id,
        name: e.name,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        maxCapacity: maxCapacity,
        ...formatCapacityPayload(e),
        eventType: e.eventType || 'English Table',
        customReservationRule: e.customReservationRule,
        location: e.location,
        notes: e.notes || DEFAULT_EVENT_NOTES,
        availableSpots: availableSpots
      };
    });
    
    res.json(result);
  } catch (err) {
    console.error('取得活動列表失敗:', err);
    next(err);
  }
});

// Phase 5：活動明細頁專用 lightweight meta（不載入 reservations 列、單次 aggregate 統計）
router.get(
  '/events/:id/meta',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      attributes: [
        'id',
        'name',
        'date',
        'startTime',
        'endTime',
        'maxCapacity',
        'groupCount',
        'perGroupCapacity',
        'eventType',
        'customReservationRule',
        'location',
        'notes',
        'autoCheckCompleted',
      ],
    });
    if (!event) return res.status(404).json({ error: '活動不存在' });

    const { getEventCheckinStats } = require('../utils/eventStats');
    const stats = await getEventCheckinStats(event.id);
    const reservedCount = Math.max(0, parseInt(stats.totalReservations) || 0);
    const maxCapacity = Math.max(0, parseInt(event.maxCapacity) || 0);
    const availableSpots = Math.max(0, maxCapacity - reservedCount);

    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      maxCapacity,
      ...formatCapacityPayload(event),
      eventType: event.eventType || 'English Table',
      customReservationRule: event.customReservationRule,
      location: event.location,
      notes: event.notes || DEFAULT_EVENT_NOTES,
      reserved: reservedCount,
      availableSpots,
      checkedInCount: Math.max(0, parseInt(stats.checkedIn) || 0),
      uncheckedCount: Math.max(0, parseInt(stats.notCheckedIn) || 0),
      violationRegisteredCount: Math.max(0, parseInt(stats.violations) || 0),
      autoCheckCompleted: event.autoCheckCompleted || false,
    });
  } catch (err) {
    console.error('取得活動 meta 失敗:', err);
    next(err);
  }
});

// Phase 5：僅 aggregate 數字（輪詢／儀表板用，與 meta 同資料來源）
router.get(
  '/events/:id/summary',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      attributes: ['id', 'autoCheckCompleted'],
    });
    if (!event) return res.status(404).json({ error: '活動不存在' });

    const { getEventCheckinStats } = require('../utils/eventStats');
    const stats = await getEventCheckinStats(event.id);

    res.json({
      eventId: event.id,
      enrolledCount: Math.max(0, parseInt(stats.totalReservations) || 0),
      checkedInCount: Math.max(0, parseInt(stats.checkedIn) || 0),
      uncheckedCount: Math.max(0, parseInt(stats.notCheckedIn) || 0),
      violationRegisteredCount: Math.max(0, parseInt(stats.violations) || 0),
      autoCheckCompleted: event.autoCheckCompleted || false,
    });
  } catch (err) {
    console.error('取得活動 summary 失敗:', err);
    next(err);
  }
});

// 2) GET /api/events/:id — 舊版相容：回傳欄位 + 統計，不含 reservations 大陣列（Phase 5 瘦身）
router.get(
  '/events/:id',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, {
      attributes: [
        'id',
        'name',
        'date',
        'startTime',
        'endTime',
        'maxCapacity',
        'eventType',
        'customReservationRule',
        'location',
        'notes',
      ],
    });
    if (!event) return res.status(404).json({ error: '活動不存在' });

    const { getEventCheckinStats } = require('../utils/eventStats');
    const stats = await getEventCheckinStats(event.id);
    const reservedCount = Math.max(0, parseInt(stats.totalReservations) || 0);
    const maxCapacity = Math.max(0, parseInt(event.maxCapacity) || 0);
    const availableSpots = Math.max(0, maxCapacity - reservedCount);

    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      maxCapacity,
      eventType: event.eventType || 'English Table',
      customReservationRule: event.customReservationRule,
      location: event.location,
      notes: event.notes || DEFAULT_EVENT_NOTES,
      reserved: reservedCount,
      availableSpots,
    });
  } catch (err) {
    console.error('取得活動詳情失敗:', err);
    next(err);
  }
});

// 3) GET /api/reports/participation-checkins — 各學期 × 活動類型之已簽到人數／人次
router.get(
  '/reports/participation-checkins',
  authMiddleware,
  requirePermission(P.CAN_VIEW_EVENTS_ADMIN),
  async (req, res, next) => {
    try {
      const eventScopeWhere = buildScopedEventQuery(req, res);
      if (eventScopeWhere === null) return;
      const data = await eventParticipationReportService.getParticipationCheckinBySemesterAndType({
        user: req.user,
        eventScopeWhere,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// 4) GET /api/reports/summary - 後台報表(需 Token)，並依日期時間排序，支援學期、活動類別與單日／區間日期篩選
router.get('/reports/summary', authMiddleware, requirePermission(P.CAN_VIEW_EVENTS_ADMIN), async (req, res, next) => {
  try {
    const {
      semester,
      eventType,
      date: dateQuery,
      dateFrom: dateFromQuery,
      dateTo: dateToQuery,
    } = req.query;
    const userRole = req.user.role;
    const eventScopeWhere = buildScopedEventQuery(req, res);
    if (eventScopeWhere === null) return;

    // 明確類型查詢時，先做 permission+scope 驗證（worker 例外：維持營運視角）
    if (eventType && eventType !== 'all' && eventType !== 'other' && userRole !== 'worker') {
      if (!canAccessEventType(req.user, eventType)) {
        return res.status(403).json({ error: '無權限查詢該活動類型' });
      }
    }
    
    // let => 可以重新指派
    let events = await Event.findAll({
      where: eventScopeWhere,
      include: { model: Reservation, attributes: ['id'] }
    });

    // 工讀生只能看到當天的活動
    if (userRole === 'worker') {
      const today = dayjs().format('YYYY-MM-DD');
      events = events.filter(event => event.date === today);
    }

    // 根據老師層級過濾活動類型
    if (userRole === 'teacher') {
      events = events.filter(event => {
        const currentEventType = event.eventType || 'English Table';
        return canAccessEventType(req.user, currentEventType);
      });
    }

    // 如果有指定學期，進行篩選
    if (semester && semester !== 'all') {
      events = events.filter(event => {
        const eventSemester = getSemesterInfo(event.date);
        return eventSemester === semester;
      });
    }

    // 如果有指定活動類別，進行篩選
    // 對於老師，活動類型已經根據層級過濾，這裡只處理管理員和工讀生
    if (eventType && eventType !== 'all' && userRole !== 'teacher') {
      events = events.filter(event => {
        const currentEventType = event.eventType || 'English Table';
        if (eventType === 'other') {
          // 其他類型：不屬於預設的四種類型
          return !['English Table', 'Job Talk', 'English Club', 'International Forum'].includes(currentEventType);
        } else {
          return currentEventType === eventType;
        }
      });
    }

    const dateStr = dateQuery != null ? String(dateQuery).trim() : '';
    const dateFromStr = dateFromQuery != null ? String(dateFromQuery).trim() : '';
    const dateToStr = dateToQuery != null ? String(dateToQuery).trim() : '';
    events = filterEventsByDateQuery(events, {
      date: dateStr,
      dateFrom: dateFromStr,
      dateTo: dateToStr,
    });

    // 依日期 -> 時間排序
    events.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      // 日期相同，再比開始時間
      if (a.startTime < b.startTime) return -1;
      if (a.startTime > b.startTime) return 1;
      return 0;
    });

    // 批量取得所有活動的簽到統計（使用共用函數）
    const eventIds = events.map(e => e.id);
    const checkinStatsMap = await getMultipleEventsCheckinStats(eventIds);

    const summary = events.map(evt => {
      // 使用共用函數取得的簽到統計（更準確）
      const stats = checkinStatsMap.get(evt.id) || {
        totalReservations: 0,
        checkedIn: 0,
        notCheckedIn: 0,
        violations: 0
      };
      
      // 直接使用共用函數的統計結果（從資料庫直接查詢，最準確）
      // getMultipleEventsCheckinStats 會為所有活動初始化統計，所以 stats.totalReservations 一定是數字
      const reservedCount = Math.max(0, parseInt(stats.totalReservations) || 0);
      const maxCapacity = Math.max(0, parseInt(evt.maxCapacity) || 0);
      
      // 計算剩餘名額，確保不會出現負數
      const availableSpots = Math.max(0, maxCapacity - reservedCount);
      
      return {
        eventId: evt.id,
        name: evt.name,
        date: evt.date,
        startTime: evt.startTime,
        endTime: evt.endTime,
        maxCapacity: maxCapacity,
        ...formatCapacityPayload(evt),
        eventType: evt.eventType || 'English Table',
        customReservationRule: evt.customReservationRule,
        location: evt.location,
        notes: evt.notes || DEFAULT_EVENT_NOTES,
        reservedCount: reservedCount,
        checkedIn: Math.max(0, parseInt(stats.checkedIn) || 0),
        notCheckedIn: Math.max(0, parseInt(stats.notCheckedIn) || 0),
        violations: Math.max(0, parseInt(stats.violations) || 0),
        availableSpots: availableSpots
      };
    });
    res.json(summary);
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: '資料庫約束錯誤',
        detail: err.message,
        meta: {
          eventId: req.params.id,
          studentId: req.body.studentId
        }
      });
    }
    next(err);
  }
});

// 4) GET /api/events/:id/reservations - 取得活動預約詳情，後台功能(需Token)
router.get(
  '/events/:id/reservations',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { 
      include: { 
        model: Reservation, 
        order: [['id', 'ASC']] 
      } 
    });
    if (!event) return res.status(404).json({ error: "活動不存在" });

    const eventType = event.eventType || 'English Table';
    const shouldGroup = eventType === 'English Table';
    const assignmentMap = shouldGroup ? await getPublishedAssignmentMap(event.id) : null;
    const reservations = shouldGroup
      ? await buildReservationGroupsForDisplay(event, event.Reservations, { assignmentMap })
      : event.Reservations.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: r.studentName,
          studentEmail: r.studentEmail,
          timestamp: r.timestamp,
          checkinStatus: r.checkinStatus || '未簽到',
          checkinTime: r.checkinTime,
          group: null,
        }));

    res.json({
      reservations,
      eventDate: event.date,
      eventStartTime: event.startTime,
      eventName: event.name,
      eventType,
      autoCheckCompleted: event.autoCheckCompleted || false,
      groupingMode: event.groupingMode || 'legacy_sequential',
    });
  } catch (err) {
    next(err);
  }
});

// 5) GET /api/events/:id/export - 匯出Excel，後台功能(需Token)
router.get(
  '/events/:id/export',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_EXPORT_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { include: { model: Reservation, order: [['id', 'ASC']] } });
    if (!event) return res.status(404).json({ error: "活動不存在" });

    const workbook = new ExcelJS.Workbook();
    const safeName = encodeURIComponent(event.name);
    const worksheet = workbook.addWorksheet(`${event.name}-報名名單`);

    // 根據活動類型決定是否包含組別欄位
    const eventType = event.eventType || 'English Table';
    const shouldGroup = eventType === 'English Table';
    
    // 設定工作表欄位
    const columns = [
      { header: '預約ID', key: 'id', width: 8 },
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'studentName', width: 15 },
      { header: 'Email', key: 'studentEmail', width: 25 },
      { header: '預約時間', key: 'timestamp', width: 20 }
    ];
    
    // 只有 English Table 活動類型才加入組別欄位
    if (shouldGroup) {
      columns.push({ header: '組別', key: 'group', width: 10 });
    }
    
    worksheet.columns = columns;

    const sortedReservations = event.Reservations.sort((a, b) => a.id - b.id);
    const assignmentMap = shouldGroup ? await getPublishedAssignmentMap(event.id) : null;
    const groupedRows = shouldGroup
      ? await buildReservationGroupsForDisplay(event, sortedReservations, { assignmentMap })
      : null;

    if (groupedRows) {
      for (const row of groupedRows) {
        const formattedTime = dayjs(row.timestamp).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
        worksheet.addRow({
          id: row.id,
          studentId: row.studentId,
          studentName: row.studentName,
          studentEmail: row.studentEmail,
          timestamp: formattedTime,
          group: row.group,
        });
      }
    } else {
      sortedReservations.forEach((r) => {
        const formattedTime = dayjs(r.timestamp).tz('Asia/Taipei').format('YYYY-MM-DD HH:mm:ss');
        worksheet.addRow({
          id: r.id,
          studentId: r.studentId,
          studentName: r.studentName,
          studentEmail: r.studentEmail,
          timestamp: formattedTime,
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-reservation.xlsx"`);

    await workbook.xlsx.write(res);

    auditLogService.logAuditAsync({
      module: 'events',
      action: 'export_reservations_excel',
      entityType: 'Event',
      entityId: event.id,
      targetSummary: `eventId=${event.id}`,
      afterData: {
        reservationCount: event.Reservations ? event.Reservations.length : null,
        eventType: event.eventType || 'English Table',
      },
      req,
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

router.get('/reports/export', authMiddleware, requirePermission(P.CAN_EXPORT_REPORTS), async (req, res, next) => {
  try {
    const eventScopeWhere = buildScopedEventQuery(req, res);
    if (eventScopeWhere === null) return;
    const events = await Event.findAll({ where: eventScopeWhere });

    // 使用共用函數取得準確的預約統計
    const eventIds = events.map(e => e.id);
    const checkinStatsMap = await getMultipleEventsCheckinStats(eventIds);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('活動報名總覽');

    worksheet.columns = [
      { header: '活動ID', key: 'id', width: 10 },
      { header: '活動名稱', key: 'name', width: 25 },
      { header: '活動類型', key: 'eventType', width: 15 },
      { header: '日期', key: 'date', width: 12 },
      { header: '開始時間', key: 'startTime', width: 12 },
      { header: '結束時間', key: 'endTime', width: 12 },
      { header: '總名額', key: 'maxCapacity', width: 10 },
      { header: '已預約', key: 'reservedCount', width: 10 },
      { header: '剩餘名額', key: 'availableSpots', width: 12 },
    ];

    events.forEach(event => {
      // 使用共用函數取得的統計結果（從資料庫直接查詢，最準確）
      const stats = checkinStatsMap.get(event.id) || {
        totalReservations: 0,
        checkedIn: 0,
        notCheckedIn: 0,
        violations: 0
      };
      const reservedCount = Math.max(0, parseInt(stats.totalReservations) || 0);
      const maxCapacity = Math.max(0, parseInt(event.maxCapacity) || 0);
      const availableSpots = Math.max(0, maxCapacity - reservedCount);
      
      worksheet.addRow({
        id: event.id,
        name: event.name,
        eventType: event.eventType || 'English Table',
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        maxCapacity: maxCapacity,
        reservedCount: reservedCount,
        availableSpots: availableSpots,
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="event-summary.xlsx"`);

    await workbook.xlsx.write(res);

    auditLogService.logAuditAsync({
      module: 'events',
      action: 'export_event_summary_excel',
      entityType: 'EventReport',
      entityId: 'all',
      targetSummary: 'reports/export',
      afterData: {
        eventsCount: events ? events.length : null,
      },
      req,
    });

    res.end();
  } catch (err) {
    next(err);
  }
});

// 5) POST /api/events - 新增活動 (需 Token)
router.post('/events', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), async (req, res, next) => {
  try {
    const { name, date, startTime, endTime, maxCapacity, eventType, customReservationRule, location, notes, groupCount, perGroupCapacity } = req.body;
    if (!name || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "缺少必要欄位" });
    }

    const capacity = normalizeEventCapacityInput({
      eventType: eventType || 'English Table',
      groupCount,
      perGroupCapacity,
      maxCapacity,
    });
    if (capacity.error) {
      return res.status(400).json({ error: capacity.error });
    }
    
    const newEvent = await Event.create({ 
      name, 
      date, 
      startTime, 
      endTime, 
      maxCapacity: capacity.maxCapacity,
      groupCount: capacity.groupCount,
      perGroupCapacity: capacity.perGroupCapacity,
      eventType: eventType || 'English Table',
      customReservationRule: customReservationRule || null,
      location: normalizeLocation(location),
      notes: normalizeNotes(notes, { useDefault: true }),
    });
    auditLogService.logAuditAsync({
      module: 'events',
      action: 'create',
      entityType: 'Event',
      entityId: newEvent.id,
      targetSummary: newEvent.name,
      afterData: {
        id: newEvent.id,
        name: newEvent.name,
        date: newEvent.date,
        eventType: newEvent.eventType,
        notes: newEvent.notes,
      },
      req,
    });
    res.json({ message: "活動新增成功", event: newEvent });
  } catch (err) {
    next(err);
  }
});

// 5.5) POST /api/events/batch - 批量新增活動 (需 Token)
router.post('/events/batch', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), async (req, res, next) => {
  try {
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "請提供活動陣列" });
    }

    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [],
      createdEvents: []
    };

    // 使用事務確保資料一致性
    const transaction = await Event.sequelize.transaction();

    try {
      for (let i = 0; i < events.length; i++) {
        const eventData = events[i];
        
        try {
          // 驗證必要欄位
          if (!eventData.name || !eventData.date || !eventData.startTime || !eventData.endTime) {
            results.failureCount++;
            results.errors.push(`第 ${i + 1} 個活動：缺少必要欄位`);
            continue;
          }

          const capacity = normalizeEventCapacityInput({
            eventType: eventData.eventType || 'English Table',
            groupCount: eventData.groupCount,
            perGroupCapacity: eventData.perGroupCapacity,
            maxCapacity: eventData.maxCapacity,
          });
          if (capacity.error) {
            results.failureCount++;
            results.errors.push(`第 ${i + 1} 個活動：${capacity.error}`);
            continue;
          }

          const newEvent = await Event.create({
            name: eventData.name,
            date: eventData.date,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            maxCapacity: capacity.maxCapacity,
            groupCount: capacity.groupCount,
            perGroupCapacity: capacity.perGroupCapacity,
            eventType: eventData.eventType || 'English Table',
            customReservationRule: eventData.customReservationRule || null,
            location: normalizeLocation(eventData.location),
            notes: normalizeNotes(eventData.notes, { useDefault: true }),
          }, { transaction });

          results.successCount++;
          results.createdEvents.push({
            id: newEvent.id,
            name: newEvent.name,
            date: newEvent.date,
            location: newEvent.location,
            notes: newEvent.notes,
          });
        } catch (err) {
          console.error(`批量新增活動時發生錯誤（第 ${i + 1} 個）:`, err);
          results.failureCount++;
          results.errors.push(`第 ${i + 1} 個活動：${err.message || '創建失敗'}`);
        }
      }

      // 如果至少有一個活動成功，提交事務
      if (results.successCount > 0) {
        await transaction.commit();
        auditLogService.logAuditAsync({
          module: 'events',
          action: 'batch_create',
          entityType: 'Event',
          entityId: 'bulk',
          targetSummary: `成功 ${results.successCount} 筆，失敗 ${results.failureCount} 筆`,
          afterData: {
            createdIds: results.createdEvents.map((e) => e.id).slice(0, 100),
            successCount: results.successCount,
            failureCount: results.failureCount,
          },
          req,
        });
        res.json({
          message: `批量新增完成：成功 ${results.successCount} 個，失敗 ${results.failureCount} 個`,
          successCount: results.successCount,
          failureCount: results.failureCount,
          errors: results.errors.length > 0 ? results.errors : undefined,
          createdEvents: results.createdEvents
        });
      } else {
        // 如果全部失敗，回滾事務，但仍返回 200 狀態碼以便前端統一處理
        await transaction.rollback();
        res.json({
          message: "所有活動新增失敗",
          successCount: 0,
          failureCount: results.failureCount,
          errors: results.errors,
          createdEvents: []
        });
      }
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('批量新增活動錯誤:', err);
    next(err);
  }
});

// 6) DELETE /api/events/:id - 刪除活動 (需 Token)
router.delete('/events/:id', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id, { include: Reservation });
    if (!event) return res.status(404).json({ error: "活動不存在" });

    if (event.Reservations.length > 0) {
      return res.status(400).json({ error: "已有學生預約，無法刪除此活動" });
    }

    const beforeSnap = {
      id: event.id,
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
    };
    await event.destroy();
    auditLogService.logAuditAsync({
      module: 'events',
      action: 'delete',
      entityType: 'Event',
      entityId: beforeSnap.id,
      targetSummary: beforeSnap.name,
      beforeData: beforeSnap,
      req,
    });
    res.json({ message: "活動刪除成功", event });
  } catch (err) {
    next(err);
  }
});

// 6.5) DELETE /api/events/:id/force-delete - 強制刪除活動 (需密碼確認)
router.delete('/events/:id/force-delete', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), requirePasswordConfirmation, async (req, res, next) => {
  try {
    const { id } = req.params;
    // 前端應傳 currentPassword（或 confirmPassword / x-confirm-password）供後端驗證操作者本人密碼

    const event = await Event.findByPk(id, { include: Reservation });
    if (!event) return res.status(404).json({ error: "活動不存在" });

    const beforeSnap = {
      id: event.id,
      name: event.name,
      date: event.date,
      reservationCount: event.Reservations ? event.Reservations.length : 0,
    };
    // 強制刪除活動（包括所有相關預約）
    await event.destroy();
    auditLogService.logAuditAsync({
      module: 'events',
      action: 'EVENT_FORCE_DELETE',
      entityType: 'Event',
      entityId: beforeSnap.id,
      targetSummary: beforeSnap.name,
      beforeData: beforeSnap,
      req,
    });
    res.json({ message: "活動及相關預約已強制刪除", event });
  } catch (err) {
    next(err);
  }
});

  // 7) PUT /api/events/:id - 修改活動 (需 Token)
const updateEventHandler = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "活動不存在" });

    const before = {
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      maxCapacity: event.maxCapacity,
      eventType: event.eventType,
      location: event.location,
      notes: event.notes,
      customReservationRule: event.customReservationRule,
    };

    const { name, date, startTime, endTime, maxCapacity, eventType, customReservationRule, location, notes, groupCount, perGroupCapacity } = req.body;
    if (name !== undefined) event.name = name;
    if (date !== undefined) event.date = date;
    if (startTime !== undefined) event.startTime = startTime;
    if (endTime !== undefined) event.endTime = endTime;
    if (eventType !== undefined) event.eventType = eventType;
    if (customReservationRule !== undefined) event.customReservationRule = customReservationRule;
    if (location !== undefined) event.location = normalizeLocation(location);
    if (notes !== undefined) event.notes = normalizeNotes(notes);

    if (maxCapacity !== undefined || groupCount !== undefined || perGroupCapacity !== undefined) {
      const capacity = normalizeEventCapacityInput({
        eventType: eventType !== undefined ? eventType : event.eventType,
        groupCount: groupCount !== undefined ? groupCount : event.groupCount,
        perGroupCapacity: perGroupCapacity !== undefined ? perGroupCapacity : event.perGroupCapacity,
        maxCapacity: maxCapacity !== undefined ? maxCapacity : event.maxCapacity,
      });
      if (capacity.error) {
        return res.status(400).json({ error: capacity.error });
      }
      event.maxCapacity = capacity.maxCapacity;
      event.groupCount = capacity.groupCount;
      event.perGroupCapacity = capacity.perGroupCapacity;
    }

    await event.save();
    const after = {
      name: event.name,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      maxCapacity: event.maxCapacity,
      eventType: event.eventType,
      location: event.location,
      notes: event.notes,
      customReservationRule: event.customReservationRule,
    };
    auditLogService.logAuditAsync({
      module: 'events',
      action: 'update',
      entityType: 'Event',
      entityId: event.id,
      targetSummary: event.name,
      beforeData: before,
      afterData: after,
      changedFields: auditLogService.diffShallow(before, after),
      req,
    });
    res.json({ message: "活動更新成功", event });
  } catch (err) {
    next(err);
  }
};

router.put('/events/:id', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), updateEventHandler);
router.patch('/events/:id', authMiddleware, requirePermission(P.CAN_MANAGE_EVENTS), updateEventHandler);

// 新增簽到功能 API（單筆）
// POST /api/events/:id/checkin
router.post(
  '/events/:id/checkin',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_CHECKIN_STUDENTS, accessEventType),
  async (req, res, next) => {
  try {
    const { reservationId } = req.body;
    const eventId = req.params.id;
    
    if (!reservationId) {
      return res.status(400).json({ error: "請提供預約ID" });
    }

    const event = req.accessEvent;

    // 檢查活動是否為當天（具活動管理權者可補簽到）
    const today = new Date().toISOString().split('T')[0]; // 取得今天的日期 YYYY-MM-DD
    const canBackdateCheckin = hasPermission(req.user, P.CAN_MANAGE_EVENTS);
    
    if (event.date !== today && !canBackdateCheckin) {
      return res.status(400).json({ error: "只能對當天的活動進行簽到" });
    }
    
    // 如果是補簽到，記錄警告訊息（但不阻止操作）
    if (event.date !== today && canBackdateCheckin) {
      console.log(`[補簽到] 用戶 ${req.user.user || req.user.username} 對 ${event.date} 的活動進行補簽到`);
    }

    // 查找預約記錄（單筆）
    const reservation = await Reservation.findOne({
      where: { 
        id: reservationId,
        eventId: eventId
      }
    });

    if (!reservation) {
      return res.status(404).json({ error: "找不到對應的預約記錄" });
    }

    // 更新簽到狀態
    const before = {
      checkinStatus: reservation.checkinStatus || null,
      checkinTime: reservation.checkinTime || null,
    };
    await reservation.update({
      checkinStatus: '已簽到',
      checkinTime: new Date()
    });

    auditLogService.logAuditAsync({
      module: 'events',
      action: 'checkin',
      entityType: 'Reservation',
      entityId: reservation.id,
      targetSummary: `eventId=${event.id}`,
      beforeData: before,
      afterData: {
        checkinStatus: '已簽到',
        checkinTime: reservation.checkinTime || null,
      },
      req,
    });

    res.json({ 
      message: "簽到成功",
      checkinTime: reservation.checkinTime
    });
  } catch (err) {
    next(err);
  }
});

// 批次簽到 API
// POST /api/events/:id/checkin/bulk
// request body: { reservationIds: [1,2,3] }
router.post(
  '/events/:id/checkin/bulk',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_CHECKIN_STUDENTS, accessEventType),
  async (req, res, next) => {
  const transaction = await require('../models').sequelize.transaction();
  try {
    const { reservationIds } = req.body || {};
    const eventId = req.params.id;

    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_RESERVATION_IDS',
        message: 'reservationIds 必須為非空陣列'
      });
    }

    const event = req.accessEvent;

    // 檢查活動是否為當天（具活動管理權者可補簽到）
    const today = new Date().toISOString().split('T')[0];
    const canBackdateCheckin = hasPermission(req.user, P.CAN_MANAGE_EVENTS);

    if (event.date !== today && !canBackdateCheckin) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "只能對當天的活動進行簽到"
      });
    }

    // 取得對應的預約紀錄
    const reservations = await Reservation.findAll({
      where: {
        id: { [Op.in]: reservationIds },
        eventId: eventId
      },
      transaction
    });

    const foundIdSet = new Set(reservations.map(r => String(r.id)));
    const now = new Date();

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const checkedInIds = [];
    const skippedIds = [];
    const failedIds = [];

    for (const reservation of reservations) {
      const idStr = String(reservation.id);

      // 只更新「未簽到」的預約，其餘狀態視為略過
      const currentStatus = reservation.checkinStatus || '未簽到';
      if (currentStatus !== '未簽到') {
        skippedCount += 1;
        skippedIds.push(reservation.id);
        continue;
      }

      const before = {
        checkinStatus: reservation.checkinStatus || null,
        checkinTime: reservation.checkinTime || null,
      };

      await reservation.update(
        {
          checkinStatus: '已簽到',
          checkinTime: now
        },
        { transaction }
      );

      successCount += 1;
      checkedInIds.push(reservation.id);

      auditLogService.logAuditAsync({
        module: 'events',
        action: 'checkin',
        entityType: 'Reservation',
        entityId: reservation.id,
        targetSummary: `eventId=${event.id}`,
        beforeData: before,
        afterData: {
          checkinStatus: '已簽到',
          checkinTime: reservation.checkinTime || now,
        },
        req,
      });
    }

    // 處理 request 中但資料庫不存在或不屬於該活動的 id
    for (const rawId of reservationIds) {
      const idStr = String(rawId);
      if (!foundIdSet.has(idStr)) {
        failedCount += 1;
        failedIds.push(rawId);
      }
    }

    if (failedCount > 0) {
      throw new Error(`BULK_CHECKIN_PARTIAL_FAILURE:${failedCount}`);
    }

    await transaction.commit();

    const totalRequested = reservationIds.length;
    const messageParts = [];
    if (successCount > 0) messageParts.push(`已成功簽到 ${successCount} 人`);
    if (skippedCount > 0) messageParts.push(`略過 ${skippedCount} 筆（已簽到或不可簽到狀態）`);
    if (failedCount > 0) messageParts.push(`處理失敗 ${failedCount} 筆`);

    const summaryMessage = messageParts.join('，') || '批次簽到完成';

    return res.json({
      success: failedCount === 0,
      message: summaryMessage,
      data: {
        totalRequested,
        successCount,
        skippedCount,
        failedCount,
        checkedInIds,
        skippedIds,
        failedIds,
      }
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logError(rollbackErr);
    }
    next(err);
  }
});

// 新增活動期間違規登記 API
// POST /api/events/:id/violations
router.post(
  '/events/:id/violations',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_MANAGE_VIOLATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const { studentId, violationType, description } = req.body;
    const eventIdParam = req.params.id;
    const parsedEventId = Number(eventIdParam);
    
    if (!Number.isInteger(parsedEventId)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_EVENT_ID',
        message: '活動ID格式錯誤',
        error: `活動ID必須為數字，收到值: ${eventIdParam}`
      });
    }
    const recordedBy = req.user.user || req.user.username || req.user.name || null; // 從認證中間件獲取使用者名稱
    if (!recordedBy) {
      return res.status(400).json({ 
        error: "登入資訊缺少使用者帳號，無法登記違規"
      });
    }
    
    // 參數驗證：確保 studentId 和 violationType 存在且不為空
    if (!studentId || studentId === undefined || studentId === null || String(studentId).trim() === '') {
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_ID',
        message: '缺少必要參數：studentId',
        error: '請提供學號'
      });
    }
    
    if (!violationType || violationType === undefined || violationType === null || String(violationType).trim() === '') {
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_VIOLATION_TYPE',
        message: '缺少必要參數：violationType',
        error: '請提供違規類型'
      });
    }

    // 查找使用者（使用 trimmed studentId）
    const trimmedStudentId = String(studentId).trim();
    const user = await User.findOne({ where: { studentId: trimmedStudentId } });
    if (!user) {
      return res.status(404).json({ error: "找不到對應的學生" });
    }

    const event = req.accessEvent;

    // 確認學生是否有該活動的預約紀錄
    const reservation = await Reservation.findOne({
      where: { eventId: event.id, userId: user.id }
    });
    if (!reservation) {
      return res.status(404).json({ error: "該學生沒有此活動的預約紀錄" });
    }
    if (reservation.checkinStatus === '已登記違規') {
      return res.status(409).json({ error: "此學生已針對該活動登記違規" });
    }

    const beforeReservation = {
      id: reservation.id,
      checkinStatus: reservation.checkinStatus || null,
      eventId: reservation.eventId || event.id,
      userId: reservation.userId || user.id,
      studentId: user.studentId || null,
    };

    const transaction = await require('../models').sequelize.transaction();
    let violation;
    try {
      violation = await EventViolation.create({
        eventId: event.id,
        userId: user.id,
        violationType: violationType,
        description: description || null,
        recordedBy: recordedBy,
        recordedAt: new Date()
      }, { transaction });

      reservation.checkinStatus = '已登記違規';
      await reservation.save({ transaction });
      await transaction.commit();
    } catch (createOrUpdateError) {
      await transaction.rollback();
      throw createOrUpdateError;
    }

    // 寫入通知（不影響違規建立主流程）
    notificationService
      .createNotification({
        userId: user.id,
        type: 'violation_create',
        title: '違規記錄已建立',
        content: `你的違規記錄已完成：${violationType}`,
        data: {
          eventId: event.id,
          eventName: event.name,
          violationType,
        },
        requestId: req.requestId || null,
        relatedEntityType: 'EventViolation',
        relatedEntityId: String(violation.id),
      })
      .catch((err) => {
        console.error('寫入違規通知失敗:', err);
      });

    auditLogService.logAuditAsync({
      module: 'events',
      action: 'violation_create',
      entityType: 'EventViolation',
      entityId: violation && violation.id ? violation.id : 'unknown',
      targetSummary: `eventId=${event.id}, violationType=${violationType}`,
      beforeData: {
        reservation: { id: reservation.id, checkinStatus: beforeReservation.checkinStatus },
      },
      afterData: {
        reservation: { id: reservation.id, checkinStatus: '已登記違規' },
      },
      req,
    });

    res.json({ 
      message: "違規記錄已建立",
      violation: violation,
      reservation: {
        id: reservation.id,
        checkinStatus: reservation.checkinStatus
      }
    });
  } catch (err) {
    console.error('[EventViolation] 登記違規時發生錯誤:', {
      error: err.name,
      message: err.message,
      stack: err.stack,
      eventId: req.params.id,
      studentId: req.body?.studentId,
      violationType: req.body?.violationType
    });
    next(err);
  }
});

// 批次登記活動中所有未簽到學生為「預約未到」
// POST /api/events/:id/violations/batch-mark-no-show
router.post(
  '/events/:id/violations/batch-mark-no-show',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_MANAGE_VIOLATIONS, accessEventType),
  async (req, res, next) => {
  try {
    if (!hasPermission(req.user, P.CAN_MANAGE_BLACKLIST)) {
      return res.status(403).json({ error: '批次登記預約未到已包含活動結束檢查，需黑名單管理權限' });
    }
    if (!canAccessEventType(req.user, accessEventType(req))) {
      return res.status(403).json({ error: '無權限存取此活動類型' });
    }

    const recordedBy = req.user.user || req.user.username || req.user.name || null;
    if (!recordedBy) {
      return res.status(400).json({
        error: '登入資訊缺少使用者帳號，無法登記違規',
      });
    }

    const result = await runEventAutoCheck({
      eventId: req.params.id,
      req,
      triggeredBy: 'batch_mark_no_show',
      recordedBy,
    });

    if (result.notFound) {
      return res.status(404).json({ error: '活動不存在' });
    }
    if (result.alreadyCompleted) {
      return res.status(400).json({
        error: result.error,
        alreadyCompleted: true,
      });
    }

    return res.json({
      message: '批次未到登記與活動結束檢查已完成',
      results: result.results,
    });
  } catch (err) {
    console.error('[EventViolation] 批次登記未簽到學生時發生錯誤:', {
      error: err.name,
      message: err.message,
      stack: err.stack,
      eventId: req.params.id
    });
    next(err);
  }
});

// 取得活動期間的違規記錄
// GET /api/events/:id/violations
router.get(
  '/events/:id/violations',
  authMiddleware,
  loadEventForAccess,
  requireAnyPermission([P.CAN_MANAGE_VIOLATIONS, P.CAN_VIEW_BLACKLIST]),
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, accessEventType),
  async (req, res, next) => {
  try {
    const eventId = req.params.id;
    
    const violations = await EventViolation.findAll({
      where: { eventId: eventId },
      include: [
        {
          model: User,
          attributes: ['studentId', 'name', 'email']
        }
      ],
      order: [['recordedAt', 'DESC']]
    });

    res.json(violations);
  } catch (err) {
    next(err);
  }
});

// 候補已停用（保留端點以免舊客戶端無說明）
// POST /api/events/:eventId/waitlist
router.post('/events/:eventId/waitlist', async (req, res, next) => {
  try {
    const result = await waitlistService.joinWaitlist();
    return res.status(410).json({
      success: false,
      errorCode: result.code,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

// 活動結束後自動檢查並記錄違規
// POST /api/events/:id/auto-check
router.post(
  '/events/:id/auto-check',
  authMiddleware,
  loadEventForAccess,
  requirePermissionAndEventAccess(P.CAN_MANAGE_BLACKLIST, accessEventType),
  async (req, res, next) => {
  try {
    const recordedBy = req.user.user || req.user.username || req.user.name || null;
    if (!recordedBy) {
      return res.status(400).json({
        error: '登入資訊缺少使用者帳號，無法執行活動結束檢查',
      });
    }

    const result = await runEventAutoCheck({
      eventId: req.params.id,
      req,
      triggeredBy: 'manual_auto_check',
      recordedBy,
    });

    if (result.notFound) {
      return res.status(404).json({ error: '活動不存在' });
    }
    if (result.alreadyCompleted) {
      return res.status(400).json({
        error: result.error,
        alreadyCompleted: true,
      });
    }

    return res.json({
      message: '活動結束檢查完成',
      results: result.results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
