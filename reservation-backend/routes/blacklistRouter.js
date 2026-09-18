// routes/blacklistRouter.js
const express = require('express');
const { authMiddleware, requirePermission, hasPermission, P } = require('../middlewares/auth');

const router = express.Router();
const { User, BlackListRecord, Reservation, Event, EventViolation, sequelize } = require('../models');
const auditLogService = require('../services/auditLogService');
const {
  enqueueBlacklistNotificationEmails,
  syncSemesterViolationCountAndMaybeBlacklist,
  afterViolationRecordDeleted,
} = require('../services/blacklistEnforcementService');
const { assertCanAccessEvent } = require('../services/accessControl/eventScopeGuard');
const { getSemesterInfo } = require('../utils/eventSemesterFromDate');
const { getCurrentSemester } = require('../utils/semester');

const VIOLATION_WRITE_PERMISSIONS = [
  P.CAN_MANAGE_VIOLATIONS,
  P.CAN_RECORD_VIOLATIONS,
];

const BLACKLIST_READ_PERMISSIONS = [
  P.CAN_VIEW_BLACKLIST,
  P.CAN_MANAGE_BLACKLIST,
  P.CAN_MANAGE_VIOLATIONS,
];

function hasAnyPermission(user, permissions) {
  return permissions.some((permission) => hasPermission(user, permission));
}

function sendForbidden(res, errorCode, message) {
  return res.status(403).json({
    success: false,
    errorCode,
    message,
  });
}

function sendScopeDenied(res, err) {
  return sendForbidden(
    res,
    err.code || 'EVENT_SCOPE_DENIED',
    err.message || '您沒有存取此活動資料的權限。'
  );
}

async function loadEventContext(req) {
  const source = { ...(req.query || {}), ...(req.body || {}), ...(req.params || {}) };
  const eventId = source.eventId;
  const reservationId = source.reservationId;

  if (eventId) {
    return Event.findByPk(eventId, { attributes: ['id', 'eventType', 'name', 'date'] });
  }

  if (reservationId) {
    const reservation = await Reservation.findByPk(reservationId, {
      attributes: ['id', 'eventId'],
      include: [{ model: Event, attributes: ['id', 'eventType', 'name', 'date'] }],
    });
    return reservation?.Event || null;
  }

  return null;
}

async function requireViolationEventScope(req, res) {
  if (!hasAnyPermission(req.user, VIOLATION_WRITE_PERMISSIONS)) {
    sendForbidden(res, 'PERMISSION_DENIED', '您沒有執行此操作的權限。');
    return null;
  }

  const event = await loadEventContext(req);
  if (!event) {
    sendForbidden(res, 'MISSING_EVENT_CONTEXT', '此操作需要指定活動或預約來源。');
    return null;
  }

  try {
    assertCanAccessEvent(req.user, event, {
      explicitEventContext: true,
      anyPermissions: VIOLATION_WRITE_PERMISSIONS,
    });
  } catch (scopeErr) {
    sendScopeDenied(res, scopeErr);
    return null;
  }

  return event;
}


// ========== 登記違規 ==========
// POST /api/blacklist/recordViolation
router.post('/recordViolation', authMiddleware, async (req, res) => {
  let transaction;
  try {
    const accessEvent = await requireViolationEventScope(req, res);
    if (!accessEvent) return;

    const { studentId, name, reason } = req.body;
    
    // 參數驗證：確保至少提供 studentId 或 name 其中一個
    const hasStudentId = studentId && studentId !== undefined && studentId !== null && String(studentId).trim() !== '';
    const hasName = name && name !== undefined && name !== null && String(name).trim() !== '';
    
    if (!hasStudentId && !hasName) {
      return res.status(400).json({ 
        success: false,
        errorCode: 'MISSING_IDENTIFIER',
        message: '請提供學號或姓名',
        error: '請提供學號或姓名'
      });
    }

    let user = null;
    if (hasStudentId) {
      const trimmedStudentId = String(studentId).trim();
      user = await User.findOne({ where: { studentId: trimmedStudentId } });
    }
    
    if (!user && hasName) {
      const trimmedName = String(name).trim();
      user = await User.findOne({ where: { name: trimmedName } });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: '找不到對應的學生',
        error: '找不到對應的學生'
      });
    }

    transaction = await sequelize.transaction();
    // ★ 新增一筆 BlackListRecord 到資料庫
    await BlackListRecord.create({
      userId: user.id,
      recordedAt: new Date(),
      reason: reason || '違規'
    }, { transaction });

    // 違規次數以當學期紀錄重算（跨學期歸零）
    const applied = await syncSemesterViolationCountAndMaybeBlacklist(user, { transaction });

    if (applied.blacklistedNow) {
      await transaction.commit();

      enqueueBlacklistNotificationEmails(applied.emailPayloads, {
        requestId: req.requestId,
        userId: user.id,
      });

      auditLogService.logAuditAsync({
        module: 'blacklist',
        action: 'record_violation_blacklist',
        entityType: 'User',
        entityId: user.id,
        targetSummary: `eventId=${accessEvent.id} violationCount=${applied.violationCount}`,
        afterData: { blacklisted: true, unlockDate: applied.unlockDate.toISOString() },
        req,
      });
      return res.json({
        message: `已達第二次違規，使用者進入黑名單至 ${applied.unlockDate.format('YYYY/MM/DD HH:mm:ss')}，並取消該期間內預約`,
      });
    }

    await transaction.commit();
    auditLogService.logAuditAsync({
      module: 'blacklist',
      action: 'record_violation_first',
      entityType: 'User',
      entityId: user.id,
      targetSummary: `eventId=${accessEvent.id} violationCount=${applied.violationCount}`,
      afterData: { violationCount: applied.violationCount },
      req,
    });
    return res.json({ message: '已紀錄此違規行為' });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error(err);
    return res.status(500).json({ message: '伺服器錯誤' });
  }
});

// ========== 批次登記違規 ==========
// POST /api/blacklist/batchRecordViolations
router.post('/batchRecordViolations', authMiddleware, async (req, res) => {
  let transaction;
  try {
    if (!await requireViolationEventScope(req, res)) return;

    const { violations } = req.body;
    if (!violations || !Array.isArray(violations)) {
      return res.status(400).json({ message: '請提供有效的違規資料' });
    }
    transaction = await sequelize.transaction();

    const results = {
      successCount: 0,
      failureCount: 0,
      failures: []
    };
    const pendingBlacklistEmails = [];

    for (const violation of violations) {
      try {
        const { studentId, name, reason } = violation;
        if (!studentId && !name) {
          results.failureCount++;
          results.failures.push({ violation, error: '請提供學號或姓名' });
          continue;
        }

        let user = await User.findOne({ where: { studentId }, transaction });
        if (!user && name) {
          user = await User.findOne({ where: { name }, transaction });
        }
        if (!user) {
          results.failureCount++;
          results.failures.push({ violation, error: '找不到對應的學生' });
          continue;
        }

        // 新增違規紀錄
        await BlackListRecord.create({
          userId: user.id,
          recordedAt: new Date(),
          reason: reason || '違規'
        }, { transaction });

        // 違規次數以當學期紀錄重算（跨學期歸零）
        const applied = await syncSemesterViolationCountAndMaybeBlacklist(user, { transaction });
        applied.emailPayloads.forEach((payload) => {
          pendingBlacklistEmails.push({ payload, userId: user.id });
        });

        results.successCount++;
      } catch (err) {
        console.error('處理單筆違規錯誤:', err);
        results.failureCount++;
        results.failures.push({ violation, error: err.message });
      }
    }

    if (results.failureCount > 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: '批次登記失敗，已回滾所有變更',
        ...results,
      });
    }

    await transaction.commit();

    pendingBlacklistEmails.forEach(({ payload, userId }) => {
      enqueueBlacklistNotificationEmails([payload], {
        requestId: req.requestId,
        userId,
      });
    });

    res.json(results);
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error('批次登記違規錯誤:', err);
    res.status(500).json({ message: '批次登記失敗' });
  }
});


// ========== 取得所有違規紀錄 ==========
// GET /api/blacklist
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { semester, eventId } = req.query;
    let scopedEvent = null;

    if (eventId) {
      if (!hasAnyPermission(req.user, BLACKLIST_READ_PERMISSIONS)) {
        return sendForbidden(res, 'PERMISSION_DENIED', '您沒有執行此操作的權限。');
      }
      scopedEvent = await Event.findByPk(eventId, { attributes: ['id', 'eventType', 'name', 'date'] });
      if (!scopedEvent) {
        return res.status(404).json({ success: false, errorCode: 'EVENT_NOT_FOUND', message: '活動不存在' });
      }
      try {
        assertCanAccessEvent(req.user, scopedEvent, {
          explicitEventContext: true,
          anyPermissions: BLACKLIST_READ_PERMISSIONS,
        });
      } catch (scopeErr) {
        return sendScopeDenied(res, scopeErr);
      }
    } else if (!hasPermission(req.user, P.CAN_MANAGE_BLACKLIST)) {
      return sendForbidden(res, 'DATA_SCOPE_DENIED', '此操作需要指定活動或預約來源。');
    }
    
    // 取得所有 BlackListRecord，關聯對應的使用者 (User)
    let records = await BlackListRecord.findAll({
      order: [['recordedAt', 'DESC']],
      include: [
        {
          model: User,
          attributes: [
            'id',
            'studentId',
            'name',
            'email',
            'violationCount',
            'isBlacklisted',
            'blacklistUntil'
          ]
        }
      ]
    });

    // 列表顯示的違規次數：指定學期用該學期筆數；否則用當學期（跨學期不累計）
    const countSemester = (semester && semester !== 'all') ? semester : getCurrentSemester();
    const semesterCountByUserId = {};
    for (const record of records) {
      if (!record.User?.id) continue;
      if (getSemesterInfo(record.recordedAt) !== countSemester) continue;
      const uid = record.User.id;
      semesterCountByUserId[uid] = (semesterCountByUserId[uid] || 0) + 1;
    }
    for (const record of records) {
      if (!record.User) continue;
      const count = semesterCountByUserId[record.User.id] || 0;
      record.User.violationCount = count;
      if (record.User.dataValues) record.User.dataValues.violationCount = count;
    }

    // 為每個記錄添加活動資訊
    for (let record of records) {
      // 檢查 User 是否存在
      if (!record.User || !record.User.id) {
        record.dataValues.eventType = null;
        record.dataValues.eventDate = null;
        record.dataValues.eventName = null;
        record.dataValues.eventId = null;
        continue;
      }

      // 查找該使用者最近的活動違規記錄
      const eventViolation = await EventViolation.findOne({
        where: { userId: record.User.id },
        include: [
          {
            model: Event,
            attributes: ['id', 'eventType', 'date', 'name']
          }
        ],
        order: [['recordedAt', 'DESC']]
      });

      if (eventViolation && eventViolation.Event) {
        record.dataValues.eventType = eventViolation.Event.eventType;
        record.dataValues.eventDate = eventViolation.Event.date;
        record.dataValues.eventName = eventViolation.Event.name;
        record.dataValues.eventId = eventViolation.Event.id;
      } else {
        // 如果沒有找到 EventViolation，嘗試從 Reservation 中查找相關活動
        const reservation = await Reservation.findOne({
          where: { userId: record.User.id },
          include: [
            {
              model: Event,
              attributes: ['id', 'eventType', 'date', 'name']
            }
          ],
          order: [['timestamp', 'DESC']]
        });

        if (reservation && reservation.Event) {
          record.dataValues.eventType = reservation.Event.eventType;
          record.dataValues.eventDate = reservation.Event.date;
          record.dataValues.eventName = reservation.Event.name;
          record.dataValues.eventId = reservation.Event.id;
        } else {
          record.dataValues.eventType = null;
          record.dataValues.eventDate = null;
          record.dataValues.eventName = null;
          record.dataValues.eventId = null;
        }
      }
    }

    if (scopedEvent) {
      records = records.filter(record => Number(record.dataValues.eventId) === Number(scopedEvent.id));
    }

    // 如果有指定學期，進行篩選
    if (semester && semester !== 'all') {
      records = records.filter(record => {
        const recordSemester = getSemesterInfo(record.recordedAt);
        return recordSemester === semester;
      });
    }

    return res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

// DELETE /api/blacklist/:recordId
router.delete('/:recordId', authMiddleware, requirePermission(P.CAN_MANAGE_BLACKLIST), async (req, res) => {
  try {
    const { recordId } = req.params;
    const record = await BlackListRecord.findOne({
      where: { id: recordId },
      include: [User]
    });
    if (!record) {
      return res.status(404).json({ message: '找不到該違規紀錄' });
    }

    const user = record.User;
    if (!user) {
      return res.status(404).json({ message: '紀錄未關聯到使用者' });
    }

    const deletedRecordedAt = record.recordedAt;
    // 先刪除紀錄，再依當學期重算次數（僅刪當學期紀錄且次數 < 2 時解除黑名單）
    await record.destroy();
    await afterViolationRecordDeleted(user, deletedRecordedAt);

    return res.json({ message: '已成功刪除該筆違規紀錄' });
  } catch (err) {
    console.error('刪除違規紀錄錯誤:', err);
    return res.status(500).json({ message: '伺服器錯誤' });
  }
});

module.exports = router;
