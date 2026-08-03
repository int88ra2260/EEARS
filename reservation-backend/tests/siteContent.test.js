const request = require('supertest');
const express = require('express');

const mockFindAll = jest.fn();
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDestroy = jest.fn();
const mockBulkCreate = jest.fn();
const mockCount = jest.fn();
const mockMax = jest.fn();

jest.mock('../middlewares/auth', () => {
  const P = {
    CAN_MANAGE_SITE_CONTENT: 'can_manage_site_content',
  };

  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { id: 99, role, teacherLevel: req.headers['x-teacher-level'] || null, staffLevel: req.headers['x-staff-level'] || null };
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

  return { authMiddleware, requirePermission, P };
});

jest.mock('../models', () => ({
  SiteContentEntry: {
    findAll: (...args) => mockFindAll(...args),
    findOne: (...args) => mockFindOne(...args),
    create: (...args) => mockCreate(...args),
    update: (...args) => mockUpdate(...args),
    destroy: (...args) => mockDestroy(...args),
    bulkCreate: (...args) => mockBulkCreate(...args),
    count: (...args) => mockCount(...args),
    max: (...args) => mockMax(...args),
  },
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
  diffShallow: jest.fn(() => []),
}));

const siteContentRouter = require('../routes/siteContentRouter');
const adminSiteContentRouter = require('../routes/adminSiteContentRouter');
const { P } = require('../middlewares/auth');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/site-content', siteContentRouter);
  app.use('/api/admin/site-content', adminSiteContentRouter);
  return app;
}

describe('site content API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  it('GET /api/site-content returns public bundle', async () => {
    mockFindAll.mockResolvedValue([
      {
        entryType: 'text',
        contentKey: 'homePage.heroTitle',
        valueZh: '自訂標題',
        valueEn: 'Custom title',
        isActive: true,
        sortOrder: 0,
        updatedAt: new Date('2026-06-18'),
        get: () => ({
          entryType: 'text',
          contentKey: 'homePage.heroTitle',
          valueZh: '自訂標題',
          valueEn: 'Custom title',
          isActive: true,
          sortOrder: 0,
          updatedAt: new Date('2026-06-18'),
        }),
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/site-content');
    expect(res.status).toBe(200);
    expect(res.body.textOverrides['homePage.heroTitle']).toEqual({
      zh: '自訂標題',
      en: 'Custom title',
    });
  });

  it('admin list requires auth', async () => {
    const app = createApp();
    const res = await request(app).get('/api/admin/site-content/sections');
    expect(res.status).toBe(401);
  });

  it('admin list requires permission', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/admin/site-content/sections')
      .set('x-user-role', 'worker')
      .set('x-allow-permissions', '');
    expect(res.status).toBe(403);
  });

  it('admin can upsert text override', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 1,
      entryType: 'text',
      section: 'home',
      contentKey: 'homePage.heroTitle',
      label: 'homePage.heroTitle',
      valueZh: '新標題',
      valueEn: 'New title',
      sortOrder: 0,
      isActive: true,
      updatedAt: new Date(),
      get: () => ({
        id: 1,
        entryType: 'text',
        section: 'home',
        contentKey: 'homePage.heroTitle',
        label: 'homePage.heroTitle',
        valueZh: '新標題',
        valueEn: 'New title',
        sortOrder: 0,
        isActive: true,
        updatedAt: new Date(),
      }),
    });

    const app = createApp();
    const res = await request(app)
      .put('/api/admin/site-content/home/text')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_SITE_CONTENT)
      .send({ contentKey: 'homePage.heroTitle', valueZh: '新標題', valueEn: 'New title' });

    expect(res.status).toBe(200);
    expect(res.body.contentKey).toBe('homePage.heroTitle');
    expect(mockCreate).toHaveBeenCalled();
  });

  it('rejects disallowed content key', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/admin/site-content/home/text')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_SITE_CONTENT)
      .send({ contentKey: 'nav.home', valueZh: 'x' });

    expect(res.status).toBe(400);
  });

  it('admin can upsert rules modal faq key', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: 2,
      entryType: 'text',
      section: 'rules_modal',
      contentKey: 'faq.rulesTitle',
      label: 'faq.rulesTitle',
      valueZh: '新標題',
      valueEn: 'New title',
      sortOrder: 0,
      isActive: true,
      updatedAt: new Date(),
      get: () => ({
        id: 2,
        entryType: 'text',
        section: 'rules_modal',
        contentKey: 'faq.rulesTitle',
        label: 'faq.rulesTitle',
        valueZh: '新標題',
        valueEn: 'New title',
        sortOrder: 0,
        isActive: true,
        updatedAt: new Date(),
      }),
    });

    const app = createApp();
    const res = await request(app)
      .put('/api/admin/site-content/rules_modal/text')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_SITE_CONTENT)
      .send({ contentKey: 'faq.rulesTitle', valueZh: '新標題', valueEn: 'New title' });

    expect(res.status).toBe(200);
    expect(res.body.contentKey).toBe('faq.rulesTitle');
  });

  it('admin can seed missing text defaults', async () => {
    mockFindOne.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 3 });

    const app = createApp();
    const res = await request(app)
      .post('/api/admin/site-content/home/text/seed')
      .set('x-user-role', 'admin')
      .set('x-allow-permissions', P.CAN_MANAGE_SITE_CONTENT)
      .send({
        items: [
          {
            contentKey: 'homePage.heroTitle',
            label: 'Hero 主標題',
            valueZh: '英語增能活動預約系統',
            valueEn: 'English Enhancement Activity Reservation System',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.seeded).toBe(1);
    expect(mockCreate).toHaveBeenCalled();
  });
});
