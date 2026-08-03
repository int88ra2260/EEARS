// routes/reservationRouter.js
const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const { Event, Reservation, User, sequelize } = require('../models');
const {
  authMiddleware,
  requirePermission,
  requirePermissionAndEventAccess,
  P,
} = require('../middlewares/auth');
const {
  publicReservationLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields,
  genericLookupResponse,
  publicLookupAudit,
} = require('../middlewares/publicAccessGuard');
const { checkSurvey } = require('../middlewares/checkSurvey');
const { calculateReservationTime } = require('../utils/reservationTime');
const { validateStudentId, validateName } = require('../utils/validators');
const { Op } = require('sequelize');
const auditLogService = require('../services/auditLogService');
const { newImportBatchId } = require('../utils/importBatchId');
const importRollbackManifestService = require('../services/importRollbackManifestService');
const notificationService = require('../services/notificationService');
const reservationService = require('../services/reservationService');
const waitlistService = require('../services/waitlistService');
const logger = require('../utils/logger');
const {
  assertCanAccessEvent,
  buildEventScopeWhere,
} = require('../services/accessControl/eventScopeGuard');

const STUDENT_ID_HEADERS = ['學號', '工號', '學員', 'studentid', '卡號', '編號'];
const NAME_HEADERS = ['姓名', 'name', '學生姓名'];
const DATE_HEADERS = ['刷卡日期', '日期', '打卡日期', 'date'];
const TIME_HEADERS = ['刷卡時間', '時間', '打卡時間', 'time'];

const cardExcelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.xls', '.xlsx'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExt.includes(ext)) {
      return cb(new Error('只允許上傳 Excel 檔案 (.xls, .xlsx)'));
    }
    cb(null, true);
  }
});

const normalizeKey = (key = '') => key.toString().replace(/\s+/g, '').toLowerCase();

async function eventTypeByParam(req) {
  const eventId = req.params?.eventId || req.query?.eventId;
  if (!eventId) return null;
  const event = await Event.findByPk(eventId, { attributes: ['eventType'] });
  return event?.eventType || null;
}

function sendScopeDenied(res, err) {
  return res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'EVENT_SCOPE_DENIED',
    message: err.message || '您沒有存取此活動資料的權限。',
  });
}

// 生成取消預約驗證碼（6位數字）
function generateCancellationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatBookingCode(reservationId) {
  const idNum = Number(reservationId);
  if (!Number.isFinite(idNum)) return `R-${String(reservationId || '').trim()}`;
  return `R-${String(idNum).padStart(6, '0')}`;
}

function buildReservationCancellationEmailData(reservation) {
  const event = reservation.Event;
  if (!event) return null;
  return {
    studentId: reservation.studentId,
    studentName: reservation.studentName,
    studentEmail: reservation.studentEmail,
    eventName: event.name,
    eventType: event.eventType,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    eventId: event.id,
  };
}

function notifyReservationCancelled(reservation, req) {
  const emailData = buildReservationCancellationEmailData(reservation);
  if (!emailData || !emailData.studentEmail) return;

  const emailQueue = require('../utils/emailQueue');
  const requestId = req.requestId;

  emailQueue.enqueue('reservationCancellation', emailData, {
    requestId,
    relatedEntityType: 'reservation',
    relatedEntityId: reservation.id,
  }).catch((err) => {
    console.error('取消預約郵件加入佇列失敗:', err);
  });

  notificationService
    .createFromEmailTemplate('reservationCancellation', emailData, {
      userId: reservation.userId,
      requestId,
      relatedEntityType: 'reservation',
      relatedEntityId: reservation.id,
    })
    .catch((err) => {
      console.error('寫入取消預約通知失敗:', err);
    });
}

async function loadWaitlistEventType(req, res, next) {
  try {
    const event = await Event.findByPk(req.params.eventId, { attributes: ['id', 'eventType'] });
    if (!event) return res.status(404).json({ error: '活動不存在' });
    req._waitlistEventType = event.eventType;
    next();
  } catch (err) {
    next(err);
  }
}

function findValueByHeaders(row, headerOptions) {
  if (!row) return '';
  for (const target of headerOptions) {
    const normalizedTarget = normalizeKey(target);
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined || value === null || value === '') continue;
      const normalizedKey = normalizeKey(key);
      if (normalizedKey === normalizedTarget || normalizedKey.includes(normalizedTarget)) {
        return value;
      }
    }
  }
  return '';
}

function extractStudentId(row) {
  const directValue = findValueByHeaders(row, STUDENT_ID_HEADERS);
  if (directValue) {
    return String(directValue).trim();
  }

  const values = Object.values(row || {});
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (!str) continue;
    const alphanumericMatch = str.match(/[A-Za-z][0-9]{6,15}/);
    if (alphanumericMatch) return alphanumericMatch[0];
    const numericMatch = str.match(/\b\d{8,10}\b/);
    if (numericMatch) return numericMatch[0];
  }
  return '';
}

function excelSerialToDate(serial) {
  if (typeof serial !== 'number') return null;
  if (XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
    }
  }
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function buildDateTime(dateValue, timeValue) {
  if (dateValue === undefined || dateValue === null || dateValue === '') return null;

  let baseDate = null;
  if (typeof dateValue === 'number') {
    baseDate = excelSerialToDate(dateValue);
  } else {
    let dateStr = String(dateValue).trim();
    if (/^\d{8}$/.test(dateStr)) {
      dateStr = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3');
    }
    dateStr = dateStr.replace(/\./g, '/');
    baseDate = new Date(dateStr);
    if (isNaN(baseDate)) {
      baseDate = new Date(dateStr.replace(/\//g, '-'));
    }
  }

  if (!baseDate || isNaN(baseDate)) return null;

  if (timeValue !== undefined && timeValue !== null && timeValue !== '') {
    if (typeof timeValue === 'number') {
      const totalSeconds = Math.round(timeValue * 24 * 60 * 60);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      baseDate.setHours(hours, minutes, seconds, 0);
    } else {
      const timeStr = String(timeValue).trim();
      if (timeStr) {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        const seconds = parseInt(parts[2], 10) || 0;
        baseDate.setHours(hours, minutes, seconds, 0);
      }
    }
  }

  return baseDate;
}

// 檢查黑名單狀態（預約前檢查）
// GET /api/users/blacklist-status
router.get('/users/blacklist-status', async (req, res) => {
  try {
    const { studentId } = req.query;
    
    if (!studentId || studentId === undefined || studentId === null || String(studentId).trim() === '') {
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_ID',
        message: '缺少必要參數：studentId',
        error: '請提供學號'
      });
    }
    
    const trimmedStudentId = String(studentId).trim();
    const user = await User.findOne({ where: { studentId: trimmedStudentId } });
    
    if (!user) {
      // 如果用戶不存在，返回未在黑名單的狀態
      return res.json({
        isBlacklisted: false,
        violationCount: 0,
        blacklistUntil: null
      });
    }
    
    // 檢查是否仍在黑名單期間
    const now = dayjs();
    const isCurrentlyBlacklisted = user.isBlacklisted && 
                                   user.blacklistUntil && 
                                   dayjs(user.blacklistUntil).isAfter(now);
    
    return res.json({
      isBlacklisted: isCurrentlyBlacklisted,
      violationCount: user.violationCount || 0,
      blacklistUntil: user.blacklistUntil || null,
      studentId: user.studentId,
      name: user.name
    });
  } catch (err) {
    console.error('檢查黑名單狀態錯誤:', err);
    return res.status(500).json({ 
      success: false,
      errorCode: 'SERVER_ERROR',
      message: '伺服器錯誤',
      error: '無法檢查黑名單狀態'
    });
  }
});

// GET /api/admin/events/:eventId/waitlist — 管理端候補名單
router.get(
  '/admin/events/:eventId/waitlist',
  authMiddleware,
  loadWaitlistEventType,
  requirePermissionAndEventAccess(P.CAN_VIEW_RESERVATIONS, (req) => req._waitlistEventType),
  async (req, res, next) => {
    try {
      const data = await waitlistService.listEventWaitlist({ eventId: req.params.eventId });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// 建立預約
// POST /api/reservations
router.post('/reservations', checkSurvey, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { eventId, studentId, studentName, studentEmail, eventType } = req.body;
    
    // 參數驗證：確保所有必要欄位存在且不為空
    if (!eventId || eventId === undefined || eventId === null) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_EVENT_ID',
        message: '缺少必要欄位：eventId',
        error: '缺少必要欄位：活動ID'
      });
    }
    
    if (!studentId || studentId === undefined || studentId === null || String(studentId).trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_ID',
        message: '缺少必要欄位：studentId',
        error: '缺少必要欄位：學號'
      });
    }
    
    if (!studentName || studentName === undefined || studentName === null || String(studentName).trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_NAME',
        message: '缺少必要欄位：studentName',
        error: '缺少必要欄位：姓名'
      });
    }
    
    if (!studentEmail || studentEmail === undefined || studentEmail === null || String(studentEmail).trim() === '') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_STUDENT_EMAIL',
        message: '缺少必要欄位：studentEmail',
        error: '缺少必要欄位：電子郵件'
      });
    }
    
    // 使用 trimmed 值
    const trimmedStudentId = String(studentId).trim();
    const trimmedStudentName = String(studentName).trim();
    const trimmedStudentEmail = String(studentEmail).trim();

    // 防呆：學號 & 姓名
    if (!validateStudentId(trimmedStudentId)) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'INVALID_STUDENT_ID',
        message: '學號格式錯誤，應為(B/M/D/N/I/J)+9位數字',
        error: '學號格式錯誤，應為(B/M/D/N/I/J)+9位數字'
      });
    }
    if (!validateName(trimmedStudentName)) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false,
        errorCode: 'INVALID_NAME',
        message: '姓名只能包含中文或英文',
        error: '姓名只能包含中文或英文'
      });
    }

    // 先檢查 User 是否存在，不存在則建立
    let user = await User.findOne({ where: { studentId: trimmedStudentId }, transaction });
    if (!user) {
      user = await User.create({
        studentId: trimmedStudentId,
        name: trimmedStudentName,
        email: trimmedStudentEmail
      }, { transaction });
    } else {
      // 同步更新使用者的姓名及email(看你需求)
      await user.update({ name: trimmedStudentName, email: trimmedStudentEmail }, { transaction });
    }

    // 檢查黑名單：若 isBlacklisted = true 且 blacklistUntil > 現在
    if (user.isBlacklisted && user.blacklistUntil && dayjs(user.blacklistUntil).isAfter(dayjs())) {
      await transaction.rollback();
      return res.status(403).json({ error: '您目前在黑名單封禁期間，無法預約' });
    }

    // 取得活動資訊並鎖定行
    const event = await Event.findByPk(eventId, { 
      include: [{
        model: Reservation,
        where: { eventId },
        required: false
      }],
      lock: true,
      transaction
    });
    
    if (!event) {
      await transaction.rollback();
      return res.status(404).json({ error: "活動不存在" });
    }

    // 根據活動類型計算預約開放時間
    const { openStart, openEnd } = calculateReservationTime(event);
    const now = dayjs();

    if (now.isBefore(openStart) || now.isAfter(openEnd)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `不在開放預約時間內( ${openStart.format('YYYY/MM/DD HH:mm')} ~ ${openEnd.format('YYYY/MM/DD HH:mm')} )`
      });
    }

    // 檢查名額
    const currentReservations = await Reservation.count({ where: { eventId }, transaction });
    const maxCapacity = event.maxCapacity;
    const availableSpots = maxCapacity - currentReservations;
    
    if (availableSpots <= 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: "活動名額已滿",
        currentReservations,
        maxCapacity,
        availableSpots: 0
      });
    }

    // 檢查是否重複預約(同學號或同email) - 使用資料庫查詢確保原子性
    const existingReservation = await Reservation.findOne({
      where: {
        eventId: event.id,
        [Op.or]: [
          { studentId: trimmedStudentId },
          { studentEmail: trimmedStudentEmail }
        ]
      },
      transaction
    });

    if (existingReservation) {
      await transaction.rollback();
      return res.status(400).json({ error: "您已報名此活動" });
    }

    // 生成取消預約驗證碼
    const cancellationCode = generateCancellationCode();

    // 建立預約 (reservation)
    const reservation = await Reservation.create({
      eventId: event.id,
      studentId: trimmedStudentId,
      studentName: trimmedStudentName,
      studentEmail: trimmedStudentEmail,
      userId: user.id,    // 關聯到 User
      timestamp: new Date(),
      cancellationCode: cancellationCode  // 儲存驗證碼
    }, { transaction });

    // 提交事務
    await transaction.commit();

    // 稽核：建立預約（不阻塞主流程）
    auditLogService.logAuditAsync({
      module: 'reservations',
      action: 'create',
      entityType: 'Reservation',
      entityId: reservation.id,
      targetSummary: `eventId=${event.id}`,
      afterData: {
        id: reservation.id,
        eventId: event.id,
        studentId: trimmedStudentId,
        checkinStatus: reservation.checkinStatus || '未簽到',
      },
      req,
    });

    // 發送預約成功通知郵件（使用佇列，非阻塞）+ 寫入通知（不影響主流程）
    const emailQueue = require('../utils/emailQueue');
    const requestId = req.requestId;
    const reservationSuccessEmailData = {
      studentId: trimmedStudentId,
      studentName: trimmedStudentName,
      studentEmail: trimmedStudentEmail,
      eventName: event.name,
      eventType: event.eventType,
      date: event.date,
      startTime: event.startTime,
      endTime: event.endTime,
      location: event.location,
      cancellationCode: cancellationCode  // 包含驗證碼
    };

    emailQueue.enqueue('reservationSuccess', reservationSuccessEmailData, {
      requestId,
      relatedEntityType: 'reservation',
      relatedEntityId: reservation.id,
    }).catch(err => {
      console.error('郵件加入佇列失敗:', err);
      // 不影響預約成功
    });

    notificationService
      .createFromEmailTemplate('reservationSuccess', reservationSuccessEmailData, {
        userId: reservation.userId,
        requestId,
        relatedEntityType: 'reservation',
        relatedEntityId: reservation.id,
      })
      .catch((err) => {
        console.error('寫入通知失敗:', err);
      });

    const finalAvailableSpots = availableSpots - 1;

    return res.json({
      success: true,
      message: "預約成功",
      reservationId: reservation.id,
      bookingCode: formatBookingCode(reservation.id),
      studentEmail: trimmedStudentEmail,
      // Reservation model uses `timestamp` (timestamps: false), keep response key for compatibility.
      createdAt: reservation.timestamp || new Date(),
      reservation,
      reservedCount: currentReservations + 1,
      availableSpots: finalAvailableSpots
    });
  } catch (error) {
    await transaction.rollback();
    console.error('預約錯誤:', error);
    
    // 檢查是否為重複預約錯誤
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "您已報名此活動" });
    }
    
    return res.status(500).json({ error: '伺服器發生錯誤，請稍後再試。', detail: error.message });
  }
});

// 舊混合取消 API 已停用，避免公開/管理權限混用
router.delete('/reservations/:id', (_req, res) => {
  return res.status(410).json({
    success: false,
    message: 'This endpoint is deprecated. Use /reservations/:id/cancel-public or /admin/reservations/:id instead.',
  });
});

// 公開取消預約（前台）
router.post(
  '/reservations/:id/cancel-public',
  publicReservationLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true, requireEmail: true }),
  async (req, res) => {
    try {
      const result = await reservationService.cancelReservationPublic({
        reservationId: req.params.id,
        studentId: req.body.studentId,
        studentName: req.body.studentName || req.body.name,
        email: req.body.email || req.body.studentEmail,
        verificationCode: req.body.verificationCode || req.body.cancellationCode,
      });

      publicLookupAudit(req, {
        action: 'reservation_public_cancel',
        entityType: 'Reservation',
        entityId: req.params.id,
        found: !!result.cancelled,
        payload: {
          studentId: req.body.studentId,
          name: req.body.studentName || req.body.name,
          email: req.body.email || req.body.studentEmail,
        },
      });

      if (result.cancelled && result.reservation?.Event) {
        notifyReservationCancelled(result.reservation, req);
        try {
          auditLogService.logAuditAsync({
            module: 'reservations',
            action: 'cancel_public',
            entityType: 'Reservation',
            entityId: result.reservation.id,
            targetSummary: `eventId=${result.reservation.Event.id}`,
            beforeData: {
              id: result.reservation.id,
              studentId: result.reservation.studentId,
            },
            afterData: null,
            req,
          });
        } catch (_) {}
      }

      const out = genericLookupResponse(res, {
        found: !!result.cancelled,
        message: 'If the reservation matches the provided information, it has been cancelled.',
      });

      if (result.cancelled && result.reservation?.Event?.id) {
        const eventId = result.reservation.Event.id;
        waitlistService
          .promoteNextWaitlistedStudent({
            eventId,
            triggeredBy: 'public_cancel',
            requestId: req.requestId,
            req,
          })
          .catch((err) => {
            logger.error('[waitlist] promote after public cancel failed', { eventId, err });
          });
      }

      return out;
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// 管理端取消預約
router.delete(
  '/admin/reservations/:id',
  authMiddleware,
  requirePermission(P.CAN_MANAGE_RESERVATIONS),
  async (req, res) => {
    try {
      const body = req.body || {};
      const reservation = await Reservation.findByPk(req.params.id, { include: [Event] });
      if (!reservation) {
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }
      try {
        assertCanAccessEvent(req.user, reservation.Event, { explicitEventContext: true });
      } catch (scopeErr) {
        return sendScopeDenied(res, scopeErr);
      }

      const result = await reservationService.cancelReservationByAdmin({
        reservationId: req.params.id,
        operator: req.user,
        verificationCode: body.verificationCode || body.cancellationCode,
      });
      if (!result.cancelled) {
        if (result.reason === 'invalid_code') {
          return res.status(400).json({ success: false, message: '驗證碼錯誤，請確認後再試。' });
        }
        if (result.reason === 'missing_reservation_code') {
          return res.status(400).json({ success: false, message: '此預約沒有驗證碼，無法使用驗證碼取消。' });
        }
        return res.status(404).json({ success: false, message: 'Reservation not found.' });
      }

      notifyReservationCancelled(result.reservation, req);

      try {
        auditLogService.logAuditAsync({
          module: 'reservations',
          action: 'ADMIN_RESERVATION_CANCEL',
          entityType: 'Reservation',
          entityId: result.reservation.id,
          targetSummary: `eventId=${result.reservation.Event ? result.reservation.Event.id : null}`,
          beforeData: {
            id: result.reservation.id,
            studentId: result.reservation.studentId,
          },
          afterData: null,
          req,
        });
      } catch (_) {}

      if (result.reservation?.Event?.id) {
        const eventId = result.reservation.Event.id;
        waitlistService
          .promoteNextWaitlistedStudent({
            eventId,
            triggeredBy: 'admin_cancel',
            requestId: req.requestId,
            req,
          })
          .catch((err) => {
            logger.error('[waitlist] promote after admin cancel failed', { eventId, err });
          });
      }

      return res.json({ success: true, message: 'Reservation cancelled.' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error.' });
    }
  }
);

// 一般用戶查詢自己的預約（不需要認證）
router.get(
  '/reservations/public',
  publicReservationLookupRateLimit,
  requireCaptchaIfEnabled,
  normalizePublicLookupInput,
  requireLookupMinimumFields({ requireStudentId: true, requireName: true, requireEmail: true }),
  async (req, res) => {
  try {
    const { studentId, studentName, studentEmail } = req.query;

    // 組合搜尋條件
    let whereClause = {};

    if (studentId) {
      whereClause.studentId = studentId;
    }

    if (studentName) {
      whereClause.studentName = studentName;
    }

    if (studentEmail) {
      whereClause.studentEmail = studentEmail;
    }

    // 查詢資料庫
    const reservations = await Reservation.findAll({
      where: whereClause,
      attributes: ['id', 'studentId', 'studentName', 'studentEmail', 'timestamp', 'eventId'],
      include: [{
        model: Event,
        attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'eventType', 'location'],
        required: false
      }],
      order: [['timestamp', 'DESC']],
      limit: 100
    });

    // 整理回傳格式
    const data = reservations.map(r => ({
      id: r.id,
      reservationId: r.id,
      bookingCode: formatBookingCode(r.id),
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      timestamp: r.timestamp,
      // Reservation table has no createdAt; map existing timestamp to preserve API contract.
      createdAt: r.timestamp,
      eventId: r.Event ? r.Event.id : null,
      eventName: r.Event ? r.Event.name : '',
      date: r.Event ? r.Event.date : '',
      startTime: r.Event ? r.Event.startTime : '',
      endTime: r.Event ? r.Event.endTime : '',
      location: r.Event ? r.Event.location : null
    }));
    publicLookupAudit(req, {
      action: 'reservation_public_lookup',
      entityType: 'Reservation',
      entityId: 'public_lookup',
      found: data.length > 0,
      payload: { studentId, studentName, studentEmail },
    });
    return genericLookupResponse(res, {
      found: data.length > 0,
      message: 'Request processed.',
      data,
    });
  } catch (err) {
    console.error('查詢預約失敗:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// 管理員/工讀生查詢所有預約（需要認證）
router.get('/reservations', authMiddleware, requirePermission(P.CAN_VIEW_RESERVATIONS), async (req, res) => {
  try {
    const { studentId, studentName, studentEmail, eventId } = req.query;

    // 組合搜尋條件
    // 若想做「完全比對」就使用 '='；若想做「部分比對」(like) 即可用 [Op.like].
    let whereClause = {};
    let includeEventScopeWhere;

    if (eventId) {
      const event = await Event.findByPk(eventId, { attributes: ['id', 'eventType'] });
      if (!event) {
        return res.status(404).json({ success: false, errorCode: 'EVENT_NOT_FOUND', message: '活動不存在' });
      }
      try {
        assertCanAccessEvent(req.user, event, { explicitEventContext: true });
      } catch (scopeErr) {
        return sendScopeDenied(res, scopeErr);
      }
      whereClause.eventId = event.id;
    } else {
      includeEventScopeWhere = buildEventScopeWhere(req.user);
      if (includeEventScopeWhere === null) {
        return res.status(403).json({
          success: false,
          errorCode: 'MISSING_EVENT_CONTEXT',
          message: '此操作需要指定活動或預約來源。',
        });
      }
    }

    if (studentId) {
      // 完全比對
      whereClause.studentId = studentId;
      // 若要部分比對可以改寫:
      // whereClause.studentId = { [Op.like]: `%${studentId}%` };
    }

    if (studentName) {
      // 完全比對
      whereClause.studentName = studentName;
      // 若要部分比對
      // whereClause.studentName = { [Op.like]: `%${studentName}%` };
    }

    if (studentEmail) {
      // 完全比對
      whereClause.studentEmail = studentEmail;
      // 若要部分比對
      // whereClause.studentEmail = { [Op.like]: `%${studentEmail}%` };
    }

    // 查詢資料庫 - 最佳化查詢
    const reservations = await Reservation.findAll({
      where: whereClause,
      attributes: ['id', 'studentId', 'studentName', 'studentEmail', 'timestamp', 'eventId'],
      include: [{
        model: Event,
        attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'eventType', 'location'],
        where: includeEventScopeWhere,
        required: !!includeEventScopeWhere && Object.keys(includeEventScopeWhere).length > 0
      }],
      order: [['timestamp', 'DESC']], // 依預約時間由新到舊排序
      limit: 1000  // 限制結果數量，避免過多資料
    });

    // 整理回傳格式（若前端需顯示活動名稱、日期、時間等）
    const data = reservations.map(r => ({
      id: r.id,
      reservationId: r.id,
      bookingCode: formatBookingCode(r.id),
      studentId: r.studentId,
      studentName: r.studentName,
      studentEmail: r.studentEmail,
      timestamp: r.timestamp,
      // Reservation table has no createdAt; map existing timestamp to preserve API contract.
      createdAt: r.timestamp,
      eventId: r.Event ? r.Event.id : null,
      eventName: r.Event ? r.Event.name : '',
      date: r.Event ? r.Event.date : '',
      startTime: r.Event ? r.Event.startTime : '',
      endTime: r.Event ? r.Event.endTime : '',
      location: r.Event ? r.Event.location : null
      // ...其他你需要的資訊
    }));

    return res.json(data);
  } catch (err) {
    console.error('取得預約失敗:', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post(
  '/reservations/:eventId/import-card-excel',
  authMiddleware,
  requirePermissionAndEventAccess(P.CAN_CHECKIN_STUDENTS, eventTypeByParam),
  cardExcelUpload.single('file'),
  async (req, res, next) => {
    const transaction = await sequelize.transaction();
    try {
      const { eventId } = req.params;
      if (!req.file) {
        await transaction.rollback();
        return res.status(400).json({ error: '請上傳 Excel 檔案' });
      }

      const event = await Event.findByPk(eventId);
      if (!event) {
        await transaction.rollback();
        return res.status(404).json({ error: '活動不存在' });
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Excel 檔案內容為空或格式不支援' });
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if (!rows.length) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Excel 檔案沒有可用資料' });
      }

      const reservations = await Reservation.findAll({ where: { eventId } });
      const reservationMap = new Map(
        reservations.map(r => [String(r.studentId).trim().toUpperCase(), r])
      );

      const processedStudentIds = new Set();
      let totalImported = 0;
      let successCount = 0;
      const updatedRecords = [];
      const importBatchId = newImportBatchId('card-excel', eventId);
      const reservationRollbacks = [];

      const notFoundSet = new Set();
      const duplicatesSet = new Set();
      const skippedByDateSet = new Set();
      const missingIdRows = [];

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const studentIdRaw = extractStudentId(row);
        if (!studentIdRaw) {
          missingIdRows.push(index + 2); // +2: 第一列為標題
          continue;
        }
        totalImported++;
        const normalizedStudentId = String(studentIdRaw).trim().toUpperCase();
        if (processedStudentIds.has(normalizedStudentId)) {
          duplicatesSet.add(normalizedStudentId);
          continue;
        }
        processedStudentIds.add(normalizedStudentId);

        const dateValue = findValueByHeaders(row, DATE_HEADERS);
        const timeValue = findValueByHeaders(row, TIME_HEADERS);
        const cardDateTime = buildDateTime(dateValue, timeValue);

        if (!cardDateTime) {
          skippedByDateSet.add(normalizedStudentId);
          continue;
        }

        const cardDateStr = dayjs(cardDateTime).format('YYYY-MM-DD');
        if (cardDateStr !== event.date) {
          skippedByDateSet.add(normalizedStudentId);
          continue;
        }

        const reservation = reservationMap.get(normalizedStudentId);
        if (!reservation) {
          notFoundSet.add(normalizedStudentId);
          continue;
        }

        reservationRollbacks.push({
          id: reservation.id,
          checkinStatus: reservation.checkinStatus,
          checkinTime: reservation.checkinTime,
        });

        await reservation.update(
          {
            checkinStatus: '已簽到',
            checkinTime: cardDateTime
          },
          { transaction }
        );

        successCount++;
        updatedRecords.push({
          reservationId: reservation.id,
          studentId: normalizedStudentId,
          studentName: reservation.studentName,
          checkinTime: cardDateTime
        });
      }

      await transaction.commit();

      if (reservationRollbacks.length) {
        await importRollbackManifestService.saveManifest({
          importBatchId,
          sourceModule: 'reservations',
          kind: 'event_card_excel',
          manifest: {
            kind: 'event_card_excel',
            eventId: Number(eventId),
            reservationRollbacks,
          },
        });
      }

      // 稽核：卡片 Excel 匯入（只記錄摘要，避免寫入原始檔內容）
      auditLogService.logAuditAsync({
        module: 'reservations',
        action: 'import_card_excel',
        entityType: 'ReservationImport',
        entityId: `event:${eventId}`,
        targetSummary: `eventId=${eventId}`,
        afterData: {
          importBatchId,
          eventId: Number(eventId),
          successCount,
          totalImported,
          notFoundCount: notFoundSet.size,
          duplicatesCount: duplicatesSet.size,
          skippedByDateCount: skippedByDateSet.size,
        },
        req,
      });

      return res.json({
        message: `匯入完成，已簽到 ${successCount} 人`,
        importBatchId,
        successCount,
        totalImported,
        notFound: Array.from(notFoundSet),
        duplicates: Array.from(duplicatesSet),
        skippedByDate: Array.from(skippedByDateSet),
        missingStudentIdRows: missingIdRows,
        updatedRecords
      });
    } catch (error) {
      await transaction.rollback();

      auditLogService.logAuditAsync({
        module: 'reservations',
        action: 'import_card_excel',
        entityType: 'ReservationImport',
        entityId: `event:${req.params.eventId}`,
        targetSummary: `eventId=${req.params.eventId}`,
        beforeData: null,
        afterData: null,
        status: 'failed',
        errorMessage: error && error.message ? error.message : String(error),
        req,
      });

      return next(error);
    }
  }
);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '檔案大小超過 5MB 限制' });
    }
    return res.status(400).json({ error: '檔案上傳失敗' });
  }

  if (error?.message?.includes('只允許上傳 Excel 檔案')) {
    return res.status(400).json({ error: error.message });
  }

  return next(error);
});

module.exports = router;
