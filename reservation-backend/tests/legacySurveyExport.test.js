const express = require('express');
const request = require('supertest');

const mockLogAuditAsync = jest.fn();

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: (...args) => mockLogAuditAsync(...args),
}));

jest.mock('../middlewares/auth', () => {
  const P = {
    CAN_VIEW_SURVEYS: 'can_view_surveys',
    CAN_EXPORT_SURVEYS: 'can_export_surveys',
    CAN_EXPORT_SURVEY_RESPONSES: 'can_export_survey_responses',
  };

  const authMiddleware = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (!role) return res.status(401).json({ error: 'unauthenticated' });
    req.user = {
      id: Number(req.headers['x-user-id'] || 1),
      role,
      name: req.headers['x-user-name'] || 'Test Admin',
    };
    req.requestId = req.headers['x-request-id'] || 'req-legacy-export-test';
    next();
  };

  const requirePermission = (permission) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!allow.includes(permission)) {
      return res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        success: false,
        error: '權限不足',
      });
    }
    return next();
  };

  const requireAnyPermission = (permissions) => (req, res, next) => {
    const allow = String(req.headers['x-allow-permissions'] || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!permissions.some((p) => allow.includes(p))) {
      return res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        success: false,
        error: '權限不足',
      });
    }
    return next();
  };

  const requireSurveyAccess = () => (_req, _res, next) => next();

  return {
    authMiddleware,
    requirePermission,
    requireAnyPermission,
    requireSurveyAccess,
    adminMiddleware: (_req, _res, next) => next(),
    P,
  };
});

jest.mock('../services/surveyCenterService', () => ({
  exportSurveyResponsesXlsx: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
}));

jest.mock('../models', () => ({
  EnglishTableSurveyResponse: {
    findAll: jest.fn().mockResolvedValue([
      {
        id: 1,
        semester: '114-2',
        studentId: 'B123456789',
        name: '測試學生',
        email: 'student.full@nsysu.edu.tw',
        grade: '大三',
        department: '資工',
        createdAt: new Date('2026-01-01'),
        toJSON() {
          return {
            id: this.id,
            semester: this.semester,
            studentId: this.studentId,
            name: this.name,
            email: this.email,
            grade: this.grade,
            department: this.department,
            createdAt: this.createdAt,
          };
        },
      },
    ]),
  },
  EnglishClubSurveyResponse: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  SurveySettings: { findAll: jest.fn().mockResolvedValue([]) },
}));

const englishTableSurveyRouter = require('../routes/englishTableSurveyRouter');
const surveyRouter = require('../routes/surveyRouter');
const adminSurveyResponsesRouter = require('../routes/adminSurveyResponsesRouter');
const { P } = require('../middlewares/auth');

function createLegacyApps() {
  const etApp = express();
  etApp.use('/api/survey', englishTableSurveyRouter);

  const adminSurveyApp = express();
  adminSurveyApp.use(
    '/api/admin/surveys',
    require('../middlewares/auth').authMiddleware,
    require('../middlewares/auth').requirePermission(P.CAN_VIEW_SURVEYS),
    surveyRouter
  );

  const newExportApp = express();
  newExportApp.use('/api/admin/survey-responses', adminSurveyResponsesRouter);

  return { etApp, adminSurveyApp, newExportApp };
}

function exportHeaders(permissions) {
  return {
    'x-user-role': 'admin',
    'x-allow-permissions': permissions.join(','),
    'x-request-id': 'req-legacy-export-test',
  };
}

describe('legacy survey export permission + audit', () => {
  beforeEach(() => {
    mockLogAuditAsync.mockClear();
  });

  it('GET /api/survey/export without export permission returns 403', async () => {
    const { etApp } = createLegacyApps();
    const res = await request(etApp)
      .get('/api/survey/export')
      .set(exportHeaders([P.CAN_VIEW_SURVEYS]));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    expect(mockLogAuditAsync).not.toHaveBeenCalled();
  });

  it('GET /api/survey/export with CAN_EXPORT_SURVEY_RESPONSES returns xlsx and writes audit', async () => {
    const { etApp } = createLegacyApps();
    const res = await request(etApp)
      .get('/api/survey/export')
      .set(exportHeaders([P.CAN_EXPORT_SURVEY_RESPONSES]));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(mockLogAuditAsync).toHaveBeenCalledTimes(1);
    const payload = mockLogAuditAsync.mock.calls[0][0];
    expect(payload.action).toBe('legacy_english_table_survey_export');
    expect(payload.afterData.surveyType).toBe('english_table');
    expect(payload.afterData.rowCount).toBe(1);
    const auditJson = JSON.stringify(payload.afterData);
    expect(auditJson).not.toMatch(/student\.full@nsysu\.edu\.tw/);
    expect(auditJson).not.toMatch(/B123456789/);
    expect(auditJson).not.toMatch(/answersJson/i);
  });

  it('GET /api/admin/surveys/export/:surveyId without export permission returns 403', async () => {
    const { adminSurveyApp } = createLegacyApps();
    const res = await request(adminSurveyApp)
      .get('/api/admin/surveys/export/english_table_feedback_114_1')
      .set(exportHeaders([P.CAN_VIEW_SURVEYS]));
    expect(res.status).toBe(403);
    expect(mockLogAuditAsync).not.toHaveBeenCalled();
  });

  it('GET /api/admin/surveys/export/:surveyId with export permission returns xlsx and audit', async () => {
    const { adminSurveyApp } = createLegacyApps();
    const res = await request(adminSurveyApp)
      .get('/api/admin/surveys/export/english_club_feedback_114_1')
      .set(exportHeaders([P.CAN_VIEW_SURVEYS, P.CAN_EXPORT_SURVEY_RESPONSES]));
    expect(res.status).toBe(200);
    expect(mockLogAuditAsync).toHaveBeenCalledTimes(1);
    const payload = mockLogAuditAsync.mock.calls[0][0];
    expect(payload.action).toBe('legacy_english_club_survey_export');
    expect(payload.afterData.surveyType).toBe('english_club');
    expect(JSON.stringify(payload.afterData)).not.toMatch(/answersJson/i);
  });

  it('new survey export route without CAN_EXPORT_SURVEY_RESPONSES returns 403', async () => {
    const { newExportApp } = createLegacyApps();
    const res = await request(newExportApp)
      .get('/api/admin/survey-responses/export/xlsx')
      .set(exportHeaders([P.CAN_VIEW_SURVEYS]));
    expect(res.status).toBe(403);
    expect(mockLogAuditAsync).not.toHaveBeenCalled();
  });
});
