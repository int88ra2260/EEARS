'use strict';

const fs = require('fs');
const path = require('path');
const {
  MAX_SHADOW_ROWS,
  isBestepFileQualityShadowEnabled,
  observeBestepScoreImport,
  evaluateBestepFileQuality,
  listMetricDefinitions,
  listTemporalContracts,
  listDomains,
  listDecisionGates,
} = require('../../analytics-contracts');

const STUDENT = 'SYN-SHADOW-1';
const NAME = '合成甲';
const EMAIL = 'person@example.com';
const ENABLED = { BESTEP_FILE_QUALITY_SHADOW_ENABLED: 'true', NODE_ENV: 'test' };

function fieldDeps() {
  return {
    getFieldValue(row, _type, field) {
      return row[field] == null || row[field] === '' ? null : row[field];
    },
    parseNullableScore(value) {
      if (value == null || value === '') return null;
      const score = Number(String(value).replace(/,/g, '').trim());
      return Number.isNaN(score) ? NaN : score;
    },
    normalizeCefrLevel(value) {
      if (value == null || value === '') return null;
      const text = String(value).trim().toUpperCase();
      const match = text.match(/^(A1|A2|B1|B2|C1|C2)\+?$/);
      return match ? match[1] : text;
    },
  };
}

function skillRow(overrides = {}) {
  return {
    studentId: STUDENT,
    studentName: NAME,
    email: EMAIL,
    listeningScore: 10,
    listeningLevel: 'B1',
    readingScore: 11,
    readingLevel: 'B1',
    speakingScore: 12,
    speakingLevel: 'B1',
    writingScore: 13,
    writingLevel: 'B1',
    ...overrides,
  };
}

function payload(rows, extra = {}) {
  return {
    rows,
    errors: [],
    semester: '114-2',
    importBatchId: 'bestep-scores-synth',
    sourceFile: 'bestep-import-synth.xlsx',
    imported: Array.isArray(rows) ? rows.length : null,
    skipped: 0,
    ...extra,
  };
}

function observe(rows, extra = {}, env = ENABLED) {
  return observeBestepScoreImport(payload(rows, extra), fieldDeps(), env);
}

describe('BESTEP file quality shadow runtime', () => {
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});

  afterEach(() => {
    info.mockClear();
  });

  afterAll(() => {
    info.mockRestore();
  });

  test('K01 flag defaults off', () => {
    expect(isBestepFileQualityShadowEnabled({})).toBe(false);
    expect(isBestepFileQualityShadowEnabled({ NODE_ENV: 'test' })).toBe(false);
    expect(isBestepFileQualityShadowEnabled({
      BESTEP_FILE_QUALITY_SHADOW_ENABLED: 'TRUE',
      NODE_ENV: 'test',
    })).toBe(false);
  });

  test('K02 production cannot enable the flag', () => {
    expect(isBestepFileQualityShadowEnabled({
      BESTEP_FILE_QUALITY_SHADOW_ENABLED: 'true',
      NODE_ENV: 'production',
    })).toBe(false);
    expect(observe([skillRow()], {}, {
      BESTEP_FILE_QUALITY_SHADOW_ENABLED: 'true',
      NODE_ENV: 'production',
    })).toBeNull();
  });

  test('K03 disabled flag does not evaluate', () => {
    expect(observe([skillRow()], {}, { NODE_ENV: 'test' })).toBeNull();
  });

  test('K04 enabled flag evaluates the in-memory window', () => {
    const diagnostic = observe([skillRow()]);
    expect(diagnostic.pilotId).toBe('bestep-file-quality');
    expect(diagnostic.evaluatedRowCount).toBe(1);
    expect(diagnostic.truncated).toBe(false);
    expect(diagnostic.governance).toEqual({
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    });
  });

  test('K10 validator failure stays inside the shadow', () => {
    const diagnostic = observeBestepScoreImport(payload([skillRow()]), {}, ENABLED);
    expect(diagnostic.status).toBe('shadow_error');
    expect(diagnostic.findings[0].code).toBe('SHADOW_INTERNAL_ERROR');
  });

  test('K13 K14 original rows stay unchanged', () => {
    const row = Object.freeze(skillRow({ listeningLevel: 'B2+' }));
    const rows = Object.freeze([row]);
    const before = JSON.stringify(rows);
    observe(rows);
    expect(JSON.stringify(rows)).toBe(before);
    expect(row.listeningLevel).toBe('B2+');
  });

  test('K15 K16 K17 missing collections stay not_observed', () => {
    const diagnostic = observe([skillRow()]);
    expect(diagnostic.populations.attendanceRows.availability).toBe('not_observed');
    expect(diagnostic.populations.projectionRecords.availability).toBe('not_observed');
    expect(diagnostic.populations.importHistory.availability).toBe('not_observed');
    expect(diagnostic.populations.currentScoreRecords.availability).toBe('not_observed');
    expect(diagnostic.populations.registrationPopulation.availability).toBe('not_observed');
    expect(diagnostic.counts.currentStateRowCount).toBeNull();
  });

  test('K18 K21 K22 a prefix over 200 rows is truncated per collection', () => {
    const rows = Array.from({ length: 450 }, (_item, index) => skillRow({
      listeningLevel: index === 210 ? 'NOT-A-LEVEL' : 'B1',
      studentId: `SYN-${index}`,
    }));
    const diagnostic = observe(rows, { imported: 450, skipped: 0 });
    expect(diagnostic.evaluatedRowCount).toBe(200);
    expect(diagnostic.totalRowCount).toBe(450);
    expect(diagnostic.truncated).toBe(true);
    expect(diagnostic.selectionMethod).toBe('first_n');
    expect(diagnostic.maxRows).toBe(MAX_SHADOW_ROWS);
    expect(diagnostic.wholeFileInference).toBe(false);
    expect(diagnostic.populations.rawFileRows).toMatchObject({
      evaluatedRowCount: 200,
      totalRowCount: 450,
      truncated: true,
      selectionMethod: 'first_n',
    });
    expect(diagnostic.populations.acceptedScoreRows.selectionMethod).toBe('accepted_within_raw_prefix');
    expect(diagnostic.populations.skippedImportRows.selectionMethod).toBe('skipped_within_raw_prefix');
    expect(diagnostic.findings.some((row) => row.code === 'SKILL_VALUE_INVALID')).toBe(false);
    expect(diagnostic.counts.writtenRowCount).toBe(450);
    expect(diagnostic.counts.acceptedRowCount).toBe(200);
  });

  test('K19 fewer than 200 rows are not truncated', () => {
    const diagnostic = observe([skillRow(), skillRow({ speakingScore: 0 })]);
    expect(diagnostic.evaluatedRowCount).toBe(2);
    expect(diagnostic.totalRowCount).toBe(2);
    expect(diagnostic.truncated).toBe(false);
    expect(diagnostic.findings.some((row) => row.code === 'SKILL_SCORE_MISSING')).toBe(false);
  });

  test('K20 unknown totals stay null', () => {
    const diagnostic = observeBestepScoreImport({
      semester: '114-2',
      imported: null,
      skipped: null,
    }, fieldDeps(), ENABLED);
    expect(diagnostic.totalRowCount).toBeNull();
    expect(diagnostic.counts.rawRowCount).toBeNull();
    expect(diagnostic.counts.acceptedRowCount).toBeNull();
    expect(diagnostic.counts.writtenRowCount).toBeNull();
    expect(diagnostic.truncated).toBe(false);
    expect(diagnostic.populations.rawFileRows.availability).toBe('not_observed');
  });

  test('K23 diagnostics omit personal identifiers', () => {
    const diagnostic = observe([skillRow()], {
      errors: [{
        row: 2,
        studentId: STUDENT,
        name: NAME,
        email: EMAIL,
        error: 'STUDENT_NOT_FOUND',
      }],
      imported: 0,
      skipped: 1,
    });
    const text = JSON.stringify(diagnostic);
    expect(text).not.toContain(STUDENT);
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(EMAIL);
    expect(diagnostic.counts.acceptedRowCount).toBe(0);
    expect(diagnostic.counts.skippedRowCount).toBe(1);
    expect(diagnostic.findings.some((row) => row.code === 'IMPORT_ROW_SKIPPED_UNMATCHED')).toBe(true);
  });

  test('K24 logging is off unless the log flag is exact true', () => {
    observe([skillRow()]);
    expect(info).not.toHaveBeenCalled();
    observe([skillRow()], {}, {
      ...ENABLED,
      BESTEP_FILE_QUALITY_SHADOW_LOG: 'true',
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(String(info.mock.calls[0][0])).not.toContain(STUDENT);
    expect(String(info.mock.calls[0][0])).toContain('bestep-file-quality-shadow');
  });

  test('score zero and collapsed plus stay distinguishable', () => {
    const diagnostic = observe([skillRow({ speakingScore: 0, listeningLevel: 'B2+' })]);
    expect(diagnostic.findings.some((row) => row.code === 'SOURCE_INFORMATION_LOSS')).toBe(true);
    expect(diagnostic.findings.some((row) => row.code === 'SKILL_SCORE_MISSING')).toBe(false);
    expect(JSON.stringify(diagnostic)).not.toContain('B2+');
  });

  test('bounded windows do not scan the unscanned tail', () => {
    const sizes = [0, 20, 200, 500, 2000];
    const observations = sizes.map((size) => {
      const rows = Array.from({ length: size }, () => skillRow());
      const started = process.hrtime.bigint();
      const diagnostic = size === 0
        ? observe([])
        : observe(rows, { imported: size, skipped: 0 });
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
      return {
        size,
        elapsedMs: Math.round(elapsedMs * 100) / 100,
        evaluatedRowCount: diagnostic.evaluatedRowCount,
        truncated: diagnostic.truncated,
      };
    });
    const disabledRows = Array.from({ length: 2000 }, () => skillRow());
    const disabledStarted = process.hrtime.bigint();
    const disabled = observe(disabledRows, { imported: 2000 }, { NODE_ENV: 'test' });
    const disabledMs = Number(process.hrtime.bigint() - disabledStarted) / 1e6;
    expect(disabled).toBeNull();
    expect(disabledMs).toBeLessThan(50);
    expect(observations.find((row) => row.size === 2000)).toMatchObject({
      evaluatedRowCount: 200,
      truncated: true,
    });
    expect(observations.find((row) => row.size === 2000).elapsedMs).toBeLessThan(1000);
    expect(observations.find((row) => row.size === 20).truncated).toBe(false);
    process.stdout.write(`[bestep-file-quality-shadow-perf] ${JSON.stringify({ disabledMs: Math.round(disabledMs * 100) / 100, observations })}\n`);
  });

  test('importer hook and governance boundaries stay local', () => {
    const service = fs.readFileSync(path.join(__dirname, '../../services/bestepImportService.js'), 'utf8');
    const attendance = service.slice(
      service.indexOf('async function importAttendanceData'),
      service.indexOf('async function importScoreData'),
    );
    expect(attendance).not.toContain('observeBestepScoreImport');
    expect(service).toContain('observeBestepScoreImport');
    const registration = fs.readFileSync(path.join(__dirname, '../../routes/englishTestRegistrationRouter.js'), 'utf8');
    const router = fs.readFileSync(path.join(__dirname, '../../routes/bestepRouter.js'), 'utf8');
    const kpi = fs.readFileSync(path.join(__dirname, '../../services/learningAnalytics/kpiReportService.js'), 'utf8');
    expect(registration).not.toContain('BESTEP_FILE_QUALITY_SHADOW_ENABLED');
    expect(kpi).not.toContain('BESTEP_FILE_QUALITY_SHADOW_ENABLED');
    expect(router).toContain("router.post('/scores/import', englishTestDomainMiddleware, upload.single('file'), importScores)");
    expect(listMetricDefinitions()).toHaveLength(32);
    expect(listTemporalContracts()).toHaveLength(9);
    expect(listDomains()).toHaveLength(7);
    expect(listDecisionGates()).toHaveLength(11);
    expect(listDecisionGates().every((gate) => gate.status === 'pending')).toBe(true);
    const commitAt = service.indexOf('await transaction.commit()');
    const shadowAt = service.indexOf('observeBestepScoreImport');
    expect(service.lastIndexOf('await transaction.rollback()')).toBeLessThan(shadowAt);
    expect(commitAt).toBeLessThan(shadowAt);
    expect(service).toContain('commitSucceeded: true');
    const controller = fs.readFileSync(path.join(__dirname, '../../controllers/bestepImportController.js'), 'utf8');
    expect(controller).not.toContain('observeBestepScoreImport');
  });
});

describe('BESTEP shadow stage semantics', () => {
  test('K1-01 K1-02 parsed rows do not claim original file fidelity', () => {
    const diagnostic = observe([skillRow({ listeningLevel: 'B2+' })], { commitSucceeded: true });
    expect(diagnostic.stage).toEqual({
      sourceStage: 'parsed_worksheet_rows',
      normalizationStatus: 'header_mapped_field_extract',
      originalFileFidelity: 'not_verified',
      selectionScope: 'first_n',
    });
    expect(diagnostic.populations.rawFileRows).toMatchObject({
      sourceStage: 'parsed_worksheet_rows',
      originalFileFidelity: 'not_verified',
      committed: false,
    });
    const loss = diagnostic.findings.find((row) => row.code === 'SOURCE_INFORMATION_LOSS');
    expect(loss.verificationStatus).toBe('undetermined');
    expect(loss.evidenceLevel).toBe('parsed_versus_normalized');
    expect(loss.originalFileFidelity).toBe('not_verified');
  });

  test('K1-03 K1-04 accepted prefix is not a raw or validated count', () => {
    const diagnostic = observe([
      skillRow(),
      skillRow({ listeningLevel: 'B2+' }),
    ], {
      errors: [{ row: 2, studentId: STUDENT, error: 'STUDENT_NOT_FOUND' }],
      imported: 1,
      skipped: 1,
      commitSucceeded: true,
    });
    expect(diagnostic.populations.rawFileRows.sourceStage).toBe('parsed_worksheet_rows');
    expect(diagnostic.populations.acceptedScoreRows.sourceStage).toBe('committed_normalized_prefix');
    expect(diagnostic.populations.acceptedScoreRows.committed).toBe(true);
    expect(diagnostic.counts.rawRowCount).toBe(2);
    expect(diagnostic.counts.acceptedRowCount).toBe(1);
    expect(diagnostic.counts.validatedRowCount).toBeNull();
    expect(diagnostic.counts.upsertSucceededRowCount).toBe(1);
    expect(diagnostic.counts.committedRowCount).toBe(1);
  });

  test('K1-05 commit evidence is required before a committed count', () => {
    const diagnostic = observe([skillRow()], { imported: 1, skipped: 0 });
    expect(diagnostic.populations.acceptedScoreRows.sourceStage).toBe('normalized_prefix_without_skip_code');
    expect(diagnostic.populations.acceptedScoreRows.committed).toBeNull();
    expect(diagnostic.counts.committedRowCount).toBeNull();
    expect(diagnostic.counts.upsertSucceededRowCount).toBe(1);
  });

  test('K1-08 K1-09 K1-10 K1-11 shadow stage errors stay inside a fixed code', () => {
    const secret = new Error(`student ${STUDENT} snapshot`);
    const stages = [
      ['snapshot', { capturePrefix: () => { throw secret; } }],
      ['input_mapping', { getFieldValue: () => { throw new Error(`student ${STUDENT} map`); } }],
      ['validator', { evaluate: () => { throw new Error(`student ${STUDENT} validator`); } }],
      ['sanitizer', { sanitize: () => { throw new Error(`student ${STUDENT} sanitizer`); } }],
    ];
    stages.forEach(([stage, override]) => {
      const diagnostic = observeBestepScoreImport(payload([skillRow()]), {
        ...fieldDeps(),
        ...override,
      }, ENABLED);
      const text = JSON.stringify(diagnostic);
      expect(diagnostic.status).toBe('shadow_error');
      expect(diagnostic.executionStage).toBe(stage);
      expect(diagnostic.findings[0].code).toBe('SHADOW_INTERNAL_ERROR');
      expect(diagnostic.counts.committedRowCount).toBeNull();
      expect(text).not.toContain(STUDENT);
      expect(text).not.toContain('student ');
    });
  });

  test('K1-12 logger failure keeps the diagnostic', () => {
    const diagnostic = observeBestepScoreImport(payload([skillRow()]), {
      ...fieldDeps(),
      log: () => { throw new Error(`student ${STUDENT} log`); },
    }, ENABLED);
    expect(diagnostic.status).not.toBe('shadow_error');
    expect(diagnostic.evaluatedRowCount).toBe(1);
    expect(JSON.stringify(diagnostic)).not.toContain(STUDENT);
  });

  test('K1-13 a thenable validator cannot escape as an unhandled rejection', async () => {
    const reasons = [];
    const onUnhandled = (reason) => { reasons.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    const diagnostic = observeBestepScoreImport(payload([skillRow()]), {
      ...fieldDeps(),
      evaluate: () => Promise.reject(new Error(`student ${STUDENT} async`)),
    }, ENABLED);
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', onUnhandled);
    expect(reasons).toEqual([]);
    expect(diagnostic.status).toBe('shadow_error');
    expect(diagnostic.executionStage).toBe('validator');
    expect(diagnostic.findings[0].code).toBe('SHADOW_ASYNC_NOT_SUPPORTED');
    expect(JSON.stringify(diagnostic)).not.toContain(STUDENT);
  });

  test('K1-19 K1-20 disabled and production paths do not capture rows', () => {
    const capturePrefix = jest.fn(() => { throw new Error('captured'); });
    expect(observeBestepScoreImport(payload([skillRow()]), {
      ...fieldDeps(),
      capturePrefix,
    }, { NODE_ENV: 'test' })).toBeNull();
    expect(observeBestepScoreImport(payload([skillRow()]), {
      ...fieldDeps(),
      capturePrefix,
    }, {
      BESTEP_FILE_QUALITY_SHADOW_ENABLED: 'true',
      NODE_ENV: 'production',
    })).toBeNull();
    expect(capturePrefix).not.toHaveBeenCalled();
    const throwingEnv = {};
    Object.defineProperty(throwingEnv, 'BESTEP_FILE_QUALITY_SHADOW_ENABLED', {
      get() { throw new Error('flag parse'); },
    });
    expect(isBestepFileQualityShadowEnabled(throwingEnv)).toBe(false);
  });

  test('K1-21 K1-24 K1-29 the prefix stops before the unscanned tail', () => {
    const backing = Array.from({ length: 200 }, (_item, index) => skillRow({
      listeningLevel: index === 1 ? 'B2+' : 'B1',
    }));
    const rows = new Proxy(backing, {
      get(target, prop, receiver) {
        if (prop === 'length') return 500;
        if (typeof prop === 'string' && /^\d+$/.test(prop) && Number(prop) >= 200) {
          throw new Error(`TAIL_READ ${STUDENT}`);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    const diagnostic = observeBestepScoreImport(payload(rows, {
      imported: 500,
      skipped: 0,
      errors: [{ row: 2, error: 'STUDENT_NOT_FOUND', studentId: STUDENT, message: NAME }],
      commitSucceeded: true,
    }), fieldDeps(), ENABLED);
    expect(diagnostic.evaluatedRowCount).toBe(200);
    expect(diagnostic.totalRowCount).toBe(500);
    expect(diagnostic.truncated).toBe(true);
    expect(diagnostic.wholeFileInference).toBe(false);
    expect(diagnostic.counts.acceptedRowCount).toBe(199);
    expect(diagnostic.counts.validatedRowCount).toBeNull();
    expect(diagnostic.counts.committedRowCount).toBe(500);
    expect(diagnostic.populations.rawFileRows.selectionScope).toBe('first_n');
    expect(diagnostic.populations.acceptedScoreRows.selectionScope).toBe('accepted_within_raw_prefix');
    expect(diagnostic.populations.skippedImportRows.selectionScope).toBe('skipped_within_raw_prefix');
    expect(diagnostic.populations.skippedImportRows.evaluatedRowCount).toBe(1);
    expect(JSON.stringify(diagnostic)).not.toContain(STUDENT);
  });

  test('K1-22 K1-23 K1-28 small and missing collections do not become zero', () => {
    const small = observe([skillRow()]);
    expect(small.truncated).toBe(false);
    expect(small.evaluatedRowCount).toBe(1);
    const unknown = observeBestepScoreImport({ semester: '114-2' }, fieldDeps(), ENABLED);
    expect(unknown.totalRowCount).toBeNull();
    expect(unknown.counts.rawRowCount).toBeNull();
    expect(unknown.counts.validatedRowCount).toBeNull();
    expect(unknown.counts.committedRowCount).toBeNull();
    expect(unknown.populations.attendanceRows.evaluatedRowCount).toBeNull();
    expect(unknown.populations.attendanceRows.availability).toBe('not_observed');
    expect(unknown.populations.projectionRecords.totalRowCount).toBeNull();
    expect(unknown.populations.importHistory.totalRowCount).toBeNull();
  });

  test('K1-25 K1-26 logs contain codes only', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const diagnostic = observeBestepScoreImport(payload([skillRow()]), {
      ...fieldDeps(),
      evaluate: () => { throw new Error(`student ${STUDENT} ${EMAIL}`); },
    }, {
      ...ENABLED,
      BESTEP_FILE_QUALITY_SHADOW_LOG: 'true',
    });
    expect(diagnostic.findings[0].code).toBe('SHADOW_INTERNAL_ERROR');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(String(infoSpy.mock.calls[0][0])).not.toContain(STUDENT);
    expect(String(infoSpy.mock.calls[0][0])).not.toContain(EMAIL);
    expect(infoSpy.mock.calls[0]).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test('K1-27 K1-30 governance and the offline report stay compatible', () => {
    const offline = evaluateBestepFileQuality({
      pilotId: 'bestep-file-quality',
      fileSemester: '114-2',
      source: {
        importType: 'bestep_score_import',
        sourceFileId: 'bestep-import-synth.xlsx',
        importRunId: 'bestep-scores-synth',
      },
      rawFileRows: [{ rowKey: 'eval:0', listeningLevel: 'B2+', listeningScore: 10 }],
      acceptedScoreRows: [{ rowKey: 'eval:0', listeningLevel: 'B2', listeningScore: 10 }],
    });
    expect(offline.verificationStatus).toBe('contract_only');
    expect(offline.findings.find((row) => row.code === 'SOURCE_INFORMATION_LOSS').verificationStatus).toBe('contract_only');
    expect(offline.governance).toEqual({
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    });
    const diagnostic = observe([skillRow({ listeningLevel: 'B2+' })], { commitSucceeded: true });
    expect(diagnostic.contractVersion).toBe('phase-4j');
    expect(diagnostic.governance).toEqual(offline.governance);
    expect(diagnostic.findings.find((row) => row.code === 'SOURCE_INFORMATION_LOSS').verificationStatus).toBe('undetermined');
    expect(listMetricDefinitions().filter((row) => row.implementationStatus === 'not_implemented')).toHaveLength(2);
  });
});
