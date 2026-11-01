'use strict';

const fs = require('fs');
const path = require('path');

jest.mock('../models', () => ({
  Class: { findByPk: jest.fn() },
}));

jest.mock('../services/bestepClassService', () => ({
  getClassBestepOverview: jest.fn(),
  buildClassBestepExportData: jest.fn(),
}));

jest.mock('../services/bestepClassExportExcel', () => ({
  writeClassBestepExportWorkbook: jest.fn(),
}));

jest.mock('../services/accessControl/classScopeGuard', () => ({
  assertCanAccessClass: jest.fn(),
  sendClassScopeDenied: jest.fn((res, err) => res.status(err.status || 403).json({
    success: false,
    errorCode: err.code || 'CLASS_SCOPE_DENIED',
  })),
}));

jest.mock('../utils/exportAudit', () => ({
  logExportAudit: jest.fn(),
}));

const { Class } = require('../models');
const {
  getClassBestepOverview,
  buildClassBestepExportData,
} = require('../services/bestepClassService');
const { writeClassBestepExportWorkbook } = require('../services/bestepClassExportExcel');
const { assertCanAccessClass } = require('../services/accessControl/classScopeGuard');
const runtime = require('../analytics-contracts/pilots/bestepClassAnalyticsShadowRuntime');
const controller = require('../controllers/bestepClassController');

function overview(page = 2) {
  return {
    classInfo: { classId: 7, className: '合成班', semester: '114-1' },
    statistics: {
      enrolledCount: 2,
      registeredCount: 1,
      passedCount: 1,
      passRate: 100,
      registrationRate: 25,
      attendanceRate: null,
    },
    students: [{
      studentId: 'SYN-M-1',
      studentName: '合成甲',
      email: 'person@example.com',
      score: { totalScore: 320, passed: true, examDate: null },
      attendance: { L: { attended: null } },
    }],
    pagination: { page, pageSize: 10, total: 1, totalPages: 1 },
  };
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end() {
      this.ended = true;
    },
  };
}

function request(query) {
  return {
    params: { classId: '7' },
    query: { semester: '114-1', examType: 'all', page: '2', pageSize: '10', search: '', ...query },
    user: { id: 3, role: 'teacher' },
  };
}

async function invoke(flag, query, payload = overview()) {
  process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED = flag;
  Class.findByPk.mockResolvedValue({ id: 7, name: '合成班' });
  getClassBestepOverview.mockResolvedValue(payload);
  assertCanAccessClass.mockResolvedValue(undefined);
  const res = response();
  await controller.getBestepOverview(request(query), res);
  return { res, payload };
}

describe('getBestepOverview class analytics shadow', () => {
  const originalFlag = process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED;
    else process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED = originalFlag;
  });

  test('shadow off and on return the same status, body, and call counts', async () => {
    const off = await invoke(undefined);
    const offCalls = {
      service: getClassBestepOverview.mock.calls,
      access: assertCanAccessClass.mock.calls,
      db: Class.findByPk.mock.calls,
    };
    jest.clearAllMocks();
    const on = await invoke('true');

    expect(off.res.statusCode).toBe(200);
    expect(on.res.statusCode).toBe(200);
    expect(on.res.body).toEqual(off.res.body);
    expect(on.res.body).toEqual(on.payload);
    expect(on.res.body.students[0].studentId).toBe('SYN-M-1');
    expect(getClassBestepOverview.mock.calls).toEqual(offCalls.service);
    expect(assertCanAccessClass.mock.calls).toEqual(offCalls.access);
    expect(Class.findByPk.mock.calls).toEqual(offCalls.db);
    expect(getClassBestepOverview).toHaveBeenCalledTimes(1);
    expect(Class.findByPk).toHaveBeenCalledTimes(1);
  });

  test('query context and pagination reach the service and stay off the response', async () => {
    const { res } = await invoke('true', { examType: 'SW', page: '3', pageSize: '25', search: 'SYN-M-1' });
    expect(getClassBestepOverview).toHaveBeenCalledWith(7, '114-1', 'SW', {
      page: 3,
      pageSize: 25,
      search: 'SYN-M-1',
    });
    expect(res.body.pagination).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
  });

  test('validator and service failures do not change the controller outcome', async () => {
    const spy = jest.spyOn(runtime, 'observeBestepClassAnalytics').mockImplementation(() => {
      throw new Error('student SYN-M-1');
    });
    const ok = await invoke('true');
    expect(ok.res.statusCode).toBe(200);
    expect(ok.res.body).toEqual(ok.payload);
    spy.mockRestore();

    const observeSpy = jest.spyOn(runtime, 'observeBestepClassAnalytics');
    process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED = 'true';
    Class.findByPk.mockResolvedValue({ id: 7 });
    assertCanAccessClass.mockResolvedValue(undefined);
    getClassBestepOverview.mockRejectedValue(new Error('overview failed'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failed = response();
    await controller.getBestepOverview(request(), failed);
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toEqual({ error: 'overview failed' });
    expect(observeSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
    observeSpy.mockRestore();
  });

  test('permission and invalid class id stop before the service and the shadow', async () => {
    process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED = 'true';
    const spy = jest.spyOn(runtime, 'observeBestepClassAnalytics');
    Class.findByPk.mockResolvedValue({ id: 7 });
    assertCanAccessClass.mockRejectedValue({ status: 403, code: 'CLASS_SCOPE_DENIED' });
    const denied = response();
    await controller.getBestepOverview(request(), denied);
    expect(denied.statusCode).toBe(403);
    expect(denied.body.errorCode).toBe('CLASS_SCOPE_DENIED');
    expect(getClassBestepOverview).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();

    jest.clearAllMocks();
    const invalid = response();
    await controller.getBestepOverview({
      params: { classId: 'abc' },
      query: { semester: '114-1' },
      user: { id: 3, role: 'teacher' },
    }, invalid);
    expect(invalid.statusCode).toBe(400);
    expect(Class.findByPk).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('export does not run the class analytics shadow', async () => {
    process.env.BESTEP_CLASS_ANALYTICS_SHADOW_ENABLED = 'true';
    const spy = jest.spyOn(runtime, 'observeBestepClassAnalytics');
    Class.findByPk.mockResolvedValue({ id: 7, name: '合成班' });
    assertCanAccessClass.mockResolvedValue(undefined);
    buildClassBestepExportData.mockResolvedValue({
      classInfo: { className: '合成班' },
      rows: [],
    });
    writeClassBestepExportWorkbook.mockReturnValue({
      xlsx: { write: jest.fn(async () => {}) },
    });
    const res = response();
    await controller.exportClassBestepOverview(request(), res);
    expect(buildClassBestepExportData).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('route authentication and teacher middleware stay in front of the overview', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/adminClasses.js'), 'utf8');
    const authAt = route.indexOf('router.use(authMiddleware)');
    const overviewAt = route.indexOf("router.get('/:classId/bestep-overview', teacherMiddleware, getBestepOverview)");
    expect(authAt).toBeGreaterThan(-1);
    expect(overviewAt).toBeGreaterThan(authAt);
    const controllerSource = fs.readFileSync(
      path.join(__dirname, '../controllers/bestepClassController.js'),
      'utf8'
    );
    const overviewSource = controllerSource.slice(
      controllerSource.indexOf('async function getBestepOverview'),
      controllerSource.indexOf('async function exportClassBestepOverview')
    );
    expect(overviewSource.indexOf('assertCanAccessClass')).toBeLessThan(overviewSource.indexOf('observeBestepClassAnalytics'));
    expect(overviewSource.indexOf('getClassBestepOverview')).toBeLessThan(overviewSource.indexOf('observeBestepClassAnalytics'));
    expect(controllerSource.slice(controllerSource.indexOf('async function exportClassBestepOverview'))).not.toContain('observeBestepClassAnalytics');
  });
});
