const { Op } = require('sequelize');
const { AuditLog, SystemLog, EmailLog } = require('../models');

async function listAudit(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      module: moduleName,
      action,
      operatorId,
      status,
      keyword,
      dateFrom,
      dateTo,
      sortOrder = 'desc',
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pg - 1) * lim;

    const where = {};
    if (moduleName) where.module = String(moduleName);
    if (action) {
      const act = String(action).trim();
      if (String(req.query.actionMode || '').toLowerCase() === 'exact') {
        where.action = act;
      } else {
        where.action = { [Op.like]: `%${act}%` };
      }
    }
    if (operatorId !== undefined && operatorId !== '') {
      const oid = parseInt(operatorId, 10);
      if (!Number.isNaN(oid)) where.operatorId = oid;
    }
    if (status) where.status = String(status);

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (keyword && String(keyword).trim()) {
      const k = `%${String(keyword).trim()}%`;
      where[Op.or] = [
        { targetSummary: { [Op.like]: k } },
        { entityId: { [Op.like]: k } },
        { errorMessage: { [Op.like]: k } },
      ];
    }

    const order =
      String(sortOrder).toLowerCase() === 'asc' ? [['createdAt', 'ASC']] : [['createdAt', 'DESC']];

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      order,
      limit: lim,
      offset,
      attributes: [
        'id',
        'module',
        'entityType',
        'entityId',
        'action',
        'operatorId',
        'operatorRole',
        'operatorName',
        'targetSummary',
        'requestId',
        'ipAddress',
        'status',
        'createdAt',
      ],
    });

    res.json({
      items: rows.map((r) => r.get({ plain: true })),
      pagination: {
        page: pg,
        limit: lim,
        total: count,
        totalPages: Math.max(Math.ceil(count / lim), 1),
      },
    });
  } catch (e) {
    next(e);
  }
}

async function getAuditDetail(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: '無效的 id' });
    }
    const row = await AuditLog.findByPk(id);
    if (!row) {
      return res.status(404).json({ error: '找不到紀錄' });
    }
    return res.json(row.get({ plain: true }));
  } catch (e) {
    next(e);
  }
}

function listSystem(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      module: moduleName, // system_logs：以 method 當作「module」概念
      action, // system_logs：以 path 當作「action」概念（可為關鍵字）
      operatorId,
      status,
      keyword,
      requestId,
      dateFrom,
      dateTo,
      sortOrder = 'desc',
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pg - 1) * lim;

    const where = {};
    if (moduleName) where.method = { [Op.like]: `%${String(moduleName).trim()}%` };
    if (action) where.path = { [Op.like]: `%${String(action).trim()}%` };
    if (operatorId !== undefined && operatorId !== '') {
      const oid = parseInt(operatorId, 10);
      if (!Number.isNaN(oid)) where.userId = oid;
    }
    if (status !== undefined && status !== '') where.status = parseInt(status, 10);
    if (requestId) where.requestId = String(requestId).trim();

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (keyword && String(keyword).trim()) {
      const k = `%${String(keyword).trim()}%`;
      where[Op.or] = [
        { path: { [Op.like]: k } },
        { ipAddress: { [Op.like]: k } },
        { userAgent: { [Op.like]: k } },
        { errorMessage: { [Op.like]: k } },
      ];
    }

    const order =
      String(sortOrder).toLowerCase() === 'asc' ? [['createdAt', 'ASC']] : [['createdAt', 'DESC']];

    SystemLog.findAndCountAll({
      where,
      order,
      limit: lim,
      offset,
      attributes: [
        'id',
        'requestId',
        'type',
        'method',
        'path',
        'status',
        'durationMs',
        'userId',
        'role',
        'ipAddress',
        'userAgent',
        'errorMessage',
        'createdAt',
      ],
    })
      .then(({ rows, count }) => {
        res.json({
          items: rows.map((r) => r.get({ plain: true })),
          pagination: {
            page: pg,
            limit: lim,
            total: count,
            totalPages: Math.max(Math.ceil(count / lim), 1),
          },
        });
      })
      .catch(next);
  } catch (e) {
    next(e);
  }
}

async function getLogsByRequestId(req, res, next) {
  try {
    const requestId = String(req.params.requestId || '').trim();
    if (!requestId) return res.status(400).json({ error: '無效的 requestId' });

    const lim = 200;
    const [systems, audits, emails] = await Promise.all([
      SystemLog.findAll({
        where: { requestId },
        order: [['createdAt', 'DESC']],
        limit: lim,
      }),
      AuditLog.findAll({
        where: { requestId },
        order: [['createdAt', 'DESC']],
        limit: lim,
      }),
      EmailLog.findAll({
        where: { requestId },
        order: [['createdAt', 'DESC']],
        limit: lim,
      }),
    ]);

    return res.json({
      requestId,
      systemLogs: systems.map((r) => r.get({ plain: true })),
      auditLogs: audits.map((r) => r.get({ plain: true })),
      emailLogs: emails.map((r) => r.get({ plain: true })),
    });
  } catch (e) {
    next(e);
  }
}

function listEmailLogs(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      module: moduleName, // email_logs：以 template 當作「module」
      action, // email_logs：以 relatedEntityType 當作「action」
      operatorId, // 這裡實際落到 relatedEntityId（最接近 operator 的概念）
      status,
      keyword,
      requestId,
      relatedEntityType,
      dateFrom,
      dateTo,
      sortOrder = 'desc',
    } = req.query;

    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pg - 1) * lim;

    const where = {};
    if (moduleName) where.template = { [Op.like]: `%${String(moduleName).trim()}%` };
    if (action) where.relatedEntityType = { [Op.like]: `%${String(action).trim()}%` };
    if (relatedEntityType) where.relatedEntityType = String(relatedEntityType).trim();
    if (operatorId !== undefined && operatorId !== '') {
      where.relatedEntityId = String(operatorId).trim();
    }
    if (status !== undefined && status !== '') where.status = String(status).trim();
    if (requestId) where.requestId = String(requestId).trim();

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt[Op.lte] = end;
      }
    }

    if (keyword && String(keyword).trim()) {
      const k = `%${String(keyword).trim()}%`;
      where[Op.or] = [
        { to: { [Op.like]: k } },
        { subject: { [Op.like]: k } },
        { template: { [Op.like]: k } },
        { errorMessage: { [Op.like]: k } },
      ];
    }

    const order =
      String(sortOrder).toLowerCase() === 'asc' ? [['createdAt', 'ASC']] : [['createdAt', 'DESC']];

    EmailLog.findAndCountAll({
      where,
      order,
      limit: lim,
      offset,
      attributes: [
        'id',
        'requestId',
        'template',
        'status',
        'to',
        'subject',
        'errorMessage',
        'relatedEntityType',
        'relatedEntityId',
        'createdAt',
      ],
    })
      .then(({ rows, count }) => {
        res.json({
          items: rows.map((r) => r.get({ plain: true })),
          pagination: {
            page: pg,
            limit: lim,
            total: count,
            totalPages: Math.max(Math.ceil(count / lim), 1),
          },
        });
      })
      .catch(next);
  } catch (e) {
    next(e);
  }
}

async function getMetricsSummary(req, res, next) {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sequelize = SystemLog.sequelize;

    const [
      requestCount,
      fiveXxCount,
      avgDurationRow,
      emailSuccess,
      emailFailed,
      emailRetry,
      auditCount,
    ] = await Promise.all([
      SystemLog.count({ where: { createdAt: { [Op.gte]: since } } }),
      SystemLog.count({
        where: {
          createdAt: { [Op.gte]: since },
          status: { [Op.gte]: 500, [Op.lte]: 599 },
        },
      }),
      SystemLog.findOne({
        attributes: [[sequelize.fn('AVG', sequelize.col('durationMs')), 'avgDurationMs']],
        where: { createdAt: { [Op.gte]: since }, durationMs: { [Op.ne]: null } },
        raw: true,
      }),
      EmailLog.count({ where: { createdAt: { [Op.gte]: since }, status: 'success' } }),
      EmailLog.count({ where: { createdAt: { [Op.gte]: since }, status: 'failed' } }),
      EmailLog.count({ where: { createdAt: { [Op.gte]: since }, status: 'retry' } }),
      AuditLog.count({ where: { createdAt: { [Op.gte]: since } } }),
    ]);

    const avgDurationMs = avgDurationRow && avgDurationRow.avgDurationMs != null
      ? Number(avgDurationRow.avgDurationMs)
      : null;

    res.json({
      metrics: {
        requestCount24h: requestCount || 0,
        fiveXxCount24h: fiveXxCount || 0,
        email: {
          success: emailSuccess || 0,
          failed: emailFailed || 0,
          retry: emailRetry || 0,
        },
        auditCount24h: auditCount || 0,
        avgRequestDurationMs24h: avgDurationMs,
      },
      since: since.toISOString(),
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  listAudit,
  getAuditDetail,
  listSystem,
  getLogsByRequestId,
  listEmailLogs,
  getMetricsSummary,
};
