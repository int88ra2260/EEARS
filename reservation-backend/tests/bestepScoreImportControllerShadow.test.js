'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../services/bestepImportService', () => ({
  importAttendanceData: jest.fn(),
  importScoreData: jest.fn(),
  generateErrorReport: jest.fn(async () => {}),
}));

jest.mock('../services/auditLogService', () => ({
  logAuditAsync: jest.fn(),
}));

jest.mock('../services/learningJourney/syncService', () => ({
  runSync: jest.fn(async () => ({ results: { bestep_scores: { inserted: 0 } } })),
}));

jest.mock('../services/learningJourney/analytics/analyticRebuildJobService', () => ({
  scheduleGlobalAnalyticsRebuild: jest.fn(async () => ({ alreadyRunning: false, data: {} })),
}));

const { importScoreData, generateErrorReport } = require('../services/bestepImportService');
const { runSync } = require('../services/learningJourney/syncService');
const { importScores } = require('../controllers/bestepImportController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function tempFile() {
  const file = path.join(os.tmpdir(), `bestep-controller-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  fs.writeFileSync(file, 'synthetic');
  return file;
}

function successResult(imported) {
  return {
    importBatchId: 'bestep-scores-synth',
    sourceFile: 'bestep-import-synth.xlsx',
    imported,
    skipped: 1,
    errors: [{
      row: 3,
      studentId: 'MIS1',
      name: '合成甲',
      error: 'STUDENT_NOT_FOUND',
      message: '找不到該學號的報名記錄（或報名狀態不是「報名成功」）',
    }],
  };
}

async function invoke(result) {
  const file = tempFile();
  importScoreData.mockResolvedValue(result);
  const req = {
    body: { semester: '114-2' },
    file: { path: file, originalname: 'scores.xlsx' },
  };
  const res = response();
  await importScores(req, res, jest.fn());
  return res;
}

describe('BESTEP score import controller shadow boundary', () => {
  const originalFlag = process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;

  beforeEach(() => {
    importScoreData.mockReset();
    generateErrorReport.mockClear();
    runSync.mockClear();
    delete process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
  });

  afterEach(() => {
    if (originalFlag == null) delete process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
    else process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = originalFlag;
  });

  test('K05 K09 K29 success JSON and sync scheduling stay the same when the flag changes', async () => {
    const off = await invoke(successResult(2));
    await new Promise((resolve) => setImmediate(resolve));
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const on = await invoke(successResult(2));
    await new Promise((resolve) => setImmediate(resolve));

    expect(on.statusCode).toBe(off.statusCode);
    const { errorFileUrl: onFile, ...onRest } = on.body;
    const { errorFileUrl: offFile, ...offRest } = off.body;
    expect(onRest).toEqual(offRest);
    expect(onFile).toMatch(/\/api\/admin\/bestep\/scores\/import\/errors\/error-report-\d+\.xlsx$/);
    expect(offFile).toMatch(/\/api\/admin\/bestep\/scores\/import\/errors\/error-report-\d+\.xlsx$/);
    expect(Object.keys(on.body).sort()).toEqual([
      'analyticsPromoteHint',
      'analyticsPromoteScheduled',
      'errorFileUrl',
      'errors',
      'importBatchId',
      'imported',
      'semester',
      'skipped',
      'success',
    ]);
    expect(on.body.analyticsPromoteScheduled).toBe(true);
    expect(runSync).toHaveBeenCalledTimes(2);
    expect(generateErrorReport).toHaveBeenCalledTimes(2);
  });

  test('K06 K30 import failures keep their HTTP status', async () => {
    const missing = response();
    await importScores({ body: { semester: '114-2' }, file: null }, missing, jest.fn());
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const missingOn = response();
    await importScores({ body: { semester: '114-2' }, file: null }, missingOn, jest.fn());
    expect(missingOn.statusCode).toBe(400);
    expect(missingOn.body).toEqual(missing.body);

    async function failOnce() {
      const file = tempFile();
      importScoreData.mockRejectedValue(new Error('boom'));
      const req = { body: { semester: '114-2' }, file: { path: file, originalname: 'scores.xlsx' } };
      const res = response();
      await importScores(req, res, jest.fn());
      return res;
    }
    const failedOff = await failOnce();
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const failedOn = await failOnce();
    expect(failedOff.statusCode).toBe(500);
    expect(failedOn.statusCode).toBe(500);
    expect(failedOn.body).toEqual({ error: 'boom' });
    expect(failedOn.body).toEqual(failedOff.body);
    expect(runSync).not.toHaveBeenCalled();
  });
});
