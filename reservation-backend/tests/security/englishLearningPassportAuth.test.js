'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../../middlewares/auth', () => {
  const P = {
    CAN_VIEW_ENGLISH_LEARNING_PASSPORTS: 'can_view_english_learning_passports',
    CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS: 'can_manage_english_learning_passports',
    CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS: 'can_review_english_learning_submissions',
    CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS: 'can_export_english_learning_passports',
    CAN_MANAGE_ENGLISH_LEARNING_RULES: 'can_manage_english_learning_rules',
  };

  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 1, role };
    next();
  };

  const requirePermission = (permission) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!allow.includes(permission)) {
      return res.status(403).json({ error: 'forbidden', permission });
    }
    return next();
  };

  const requireAnyPermission = (permissions) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!permissions.some((p) => allow.includes(p))) {
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };

  return { authMiddleware, requirePermission, requireAnyPermission, P };
});

jest.mock('../../services/englishLearningPassport/passportService', () => ({
  listPassportsAdmin: jest.fn().mockResolvedValue([]),
  listSubmissionsAdmin: jest.fn().mockResolvedValue([]),
  approveSubmissionAdmin: jest.fn(),
  listRulesAdmin: jest.fn().mockResolvedValue([]),
  createRuleAdmin: jest.fn().mockResolvedValue({ id: 99, code: 'NEW_RULE' }),
  updateRuleAdmin: jest.fn().mockResolvedValue({ id: 1, code: 'TUTOR_CONSULTATION' }),
  deleteRuleAdmin: jest.fn().mockResolvedValue({ id: 1, code: 'TUTOR_CONSULTATION' }),
  batchDeletePassportsAdmin: jest.fn().mockResolvedValue({ deleted: [1], failed: [] }),
  batchRejectPassportsAdmin: jest.fn().mockResolvedValue({ rejected: [1], failed: [] }),
  deletePassportAdmin: jest.fn().mockResolvedValue({ id: 1, deleted: true }),
}));

jest.mock('../../services/englishLearningPassport/exportService', () => ({
  exportPassportsXlsx: jest.fn().mockResolvedValue({
    buffer: Buffer.from('xlsx'),
    fileName: 'test.xlsx',
    contentDisposition: 'attachment; filename="test.xlsx"',
  }),
}));

jest.mock('../../services/siteContentService', () => ({
  listAdmin: jest.fn().mockResolvedValue({
    section: 'english_learning_passport',
    sectionLabel: '英語實踐歷程護照',
    items: [],
  }),
  upsertTextEntry: jest.fn().mockResolvedValue({
    id: 1,
    contentKey: 'elpPage.heroTitle',
    valueZh: '測試',
  }),
  deleteEntry: jest.fn().mockResolvedValue(true),
  seedTextFromDefaults: jest.fn().mockResolvedValue({ seeded: 0, skipped: 0 }),
}));

const adminRouter = require('../../routes/adminEnglishLearningPassportRouter');
const { P } = require('../../middlewares/auth');
const siteContentService = require('../../services/siteContentService');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  return app;
}

describe('admin english learning passport auth', () => {
  it('未登入回傳 401', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/english-learning-passports');
    expect(res.status).toBe(401);
  });

  it('權限不足回傳 403', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/english-learning-passports')
      .set('x-user-role', 'teacher')
      .set('x-allow-permissions', '');
    expect(res.status).toBe(403);
  });

  it('有查看權限可存取列表', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/english-learning-passports')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('匯出需 EXPORT 權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .get('/api/admin/english-learning-passports/export/xlsx')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/admin/english-learning-passports/export/xlsx')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_EXPORT_ENGLISH_LEARNING_PASSPORTS);
    expect(ok.status).toBe(200);
  });

  it('審核需 REVIEW 權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .get('/api/admin/english-learning-passports/submissions')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/admin/english-learning-passports/submissions')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_REVIEW_ENGLISH_LEARNING_SUBMISSIONS);
    expect(ok.status).toBe(200);
  });

  it('規則列表與新增需 VIEW 或 MANAGE_RULES 權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .get('/api/admin/english-learning-passports/rules')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', '');
    expect(denied.status).toBe(403);

    const listOk = await request(app)
      .get('/api/admin/english-learning-passports/rules')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(listOk.status).toBe(200);

    const createOk = await request(app)
      .post('/api/admin/english-learning-passports/rules')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS)
      .send({ code: 'NEW_RULE', name: '新規則', basePoints: 1 });
    expect(createOk.status).toBe(201);

    const deleteOk = await request(app)
      .delete('/api/admin/english-learning-passports/rules/1')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(deleteOk.status).toBe(200);
  });

  it('批量刪除需 MANAGE 權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .post('/api/admin/english-learning-passports/batch-delete')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS)
      .send({ ids: [1, 2] });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post('/api/admin/english-learning-passports/batch-delete')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS)
      .send({ ids: [1, 2] });
    expect(ok.status).toBe(200);
    expect(ok.body.data.deleted).toEqual([1]);
  });

  it('學生頁面文案 page-ui 需 MANAGE 權限', async () => {
    const app = createApp();
    const denied = await request(app)
      .get('/api/admin/english-learning-passports/page-ui')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_VIEW_ENGLISH_LEARNING_PASSPORTS);
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .get('/api/admin/english-learning-passports/page-ui')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS);
    expect(ok.status).toBe(200);
    expect(siteContentService.listAdmin).toHaveBeenCalledWith({
      section: 'english_learning_passport',
    });

    const upsert = await request(app)
      .put('/api/admin/english-learning-passports/page-ui/text')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_ENGLISH_LEARNING_PASSPORTS)
      .send({ contentKey: 'elpPage.heroTitle', valueZh: '測試', valueEn: 'Test' });
    expect(upsert.status).toBe(200);
  });
});
