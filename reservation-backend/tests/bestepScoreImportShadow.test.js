'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');

jest.mock('../models', () => {
  const mockTransaction = {
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
  };
  return {
    sequelize: {
      transaction: jest.fn(async () => mockTransaction),
    },
    EnglishTestRegistration: {},
    BestepAttendance: { upsert: jest.fn() },
    BestepExamScore: { upsert: jest.fn(async () => ({})) },
  };
});

jest.mock('../services/englishTestRegistrationService', () => ({
  findRegistrationForSemester: jest.fn(async (studentId) => ({
    registration: studentId === 'MIS1' ? null : { status: 'success' },
  })),
}));

const { BestepExamScore, sequelize } = require('../models');
const { findRegistrationForSemester } = require('../services/englishTestRegistrationService');
const { importScoreData } = require('../services/bestepImportService');
const runtime = require('../analytics-contracts/pilots/bestepFileQualityShadowRuntime');

let transaction;

function sheetRow(studentId, overrides = {}) {
  return {
    學號: studentId,
    考生姓名: '合成甲',
    email: 'person@example.com',
    聽力總分: 10,
    聽力CEFR級數: 'B2+',
    閱讀總分: 11,
    閱讀CEFR級數: 'B1',
    口說總分: Object.prototype.hasOwnProperty.call(overrides, '口說總分') ? overrides.口說總分 : 12,
    口說CEFR級數: 'B1',
    寫作總分: 13,
    寫作CEFR級數: 'B1',
  };
}

function writeBook(rows) {
  const file = path.join(os.tmpdir(), `bestep-shadow-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'scores');
  XLSX.writeFile(book, file);
  return file;
}

function comparable(result) {
  return {
    imported: result.imported,
    skipped: result.skipped,
    errors: result.errors.map((row) => ({
      row: row.row,
      studentId: row.studentId,
      error: row.error,
    })),
  };
}

describe('BESTEP score import shadow boundary', () => {
  const originalFlag = process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
  let readFile;

  beforeAll(async () => {
    transaction = await sequelize.transaction();
  });

  beforeEach(() => {
    transaction.commit.mockClear();
    transaction.rollback.mockClear();
    sequelize.transaction.mockClear();
    BestepExamScore.upsert.mockClear();
    BestepExamScore.upsert.mockResolvedValue({});
    findRegistrationForSemester.mockClear();
    delete process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
    readFile = jest.spyOn(XLSX, 'readFile');
  });

  afterEach(() => {
    readFile.mockRestore();
    if (originalFlag == null) delete process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
    else process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = originalFlag;
  });

  test('K05 K07 K08 K11 K12 shadow on and off keep the same import result', async () => {
    const rows = [sheetRow('SYN1'), sheetRow('MIS1'), sheetRow('SYN2', { 口說總分: 0 })];
    const offFile = writeBook(rows);
    const onFile = writeBook(rows);
    const offBefore = XLSX.utils.sheet_to_json(XLSX.readFile(offFile).Sheets.scores);
    readFile.mockClear();

    const off = await importScoreData(offFile, '114-2');
    const offReads = readFile.mock.calls.length;
    const offUpserts = BestepExamScore.upsert.mock.calls.length;
    const offLookups = findRegistrationForSemester.mock.calls.length;

    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const observe = jest.spyOn(runtime, 'observeBestepScoreImport');
    const on = await importScoreData(onFile, '114-2');

    expect(comparable(on)).toEqual(comparable(off));
    expect(on.imported).toBe(2);
    expect(on.skipped).toBe(1);
    expect(on.errors.map((row) => row.error)).toEqual(['STUDENT_NOT_FOUND']);
    expect(BestepExamScore.upsert).toHaveBeenCalledTimes(offUpserts + 2);
    expect(findRegistrationForSemester).toHaveBeenCalledTimes(offLookups + 3);
    expect(readFile.mock.calls.length).toBe(offReads + 1);
    expect(observe).toHaveBeenCalledTimes(1);
    const diagnostic = observe.mock.results[0].value;
    const text = JSON.stringify(diagnostic);
    expect(text).not.toContain('SYN1');
    expect(text).not.toContain('MIS1');
    expect(text).not.toContain('合成甲');
    expect(text).not.toContain('person@example.com');
    expect(diagnostic.populations.attendanceRows.availability).toBe('not_observed');
    expect(diagnostic.populations.projectionRecords.availability).toBe('not_observed');
    expect(diagnostic.populations.importHistory.availability).toBe('not_observed');
    expect(diagnostic.wholeFileInference).toBe(false);
    expect(XLSX.utils.sheet_to_json(XLSX.readFile(offFile).Sheets.scores)).toEqual(offBefore);
    fs.unlinkSync(offFile);
    fs.unlinkSync(onFile);
    observe.mockRestore();
  });

  test('K03 flag off does not call the shadow', async () => {
    const file = writeBook([sheetRow('SYN1')]);
    const observe = jest.spyOn(runtime, 'observeBestepScoreImport');
    await importScoreData(file, '114-2');
    expect(observe).not.toHaveBeenCalled();
    fs.unlinkSync(file);
    observe.mockRestore();
  });

  test('K10 K30 shadow and database failures stay on their own paths', async () => {
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const observe = jest.spyOn(runtime, 'observeBestepScoreImport').mockImplementation(() => {
      throw new Error('shadow failed');
    });
    const file = writeBook([sheetRow('SYN1')]);
    const result = await importScoreData(file, '114-2');
    expect(result.imported).toBe(1);
    expect(transaction.commit).toHaveBeenCalled();
    expect(transaction.rollback).not.toHaveBeenCalled();
    fs.unlinkSync(file);
    observe.mockRestore();

    const liveObserve = jest.spyOn(runtime, 'observeBestepScoreImport');
    transaction.commit.mockRejectedValueOnce(new Error('commit failed'));
    const failing = writeBook([sheetRow('SYN1')]);
    await expect(importScoreData(failing, '114-2')).rejects.toThrow('commit failed');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(liveObserve).not.toHaveBeenCalled();
    fs.unlinkSync(failing);
    liveObserve.mockRestore();
  });

  test('K1-05 K1-06 K1-07 commit success is the only committed shadow', async () => {
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const observe = jest.spyOn(runtime, 'observeBestepScoreImport');
    const file = writeBook([sheetRow('SYN1'), sheetRow('MIS1')]);
    const result = await importScoreData(file, '114-2');
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0][0].commitSucceeded).toBe(true);
    const diagnostic = observe.mock.results[0].value;
    expect(diagnostic.counts.committedRowCount).toBe(1);
    expect(diagnostic.counts.validatedRowCount).toBeNull();
    expect(diagnostic.counts.upsertSucceededRowCount).toBe(1);
    expect(diagnostic.populations.rawFileRows.sourceStage).toBe('parsed_worksheet_rows');
    expect(diagnostic.populations.rawFileRows.originalFileFidelity).toBe('not_verified');
    expect(diagnostic.populations.acceptedScoreRows.sourceStage).toBe('committed_normalized_prefix');
    expect(diagnostic.populations.acceptedScoreRows.evaluatedRowCount).toBe(1);
    expect(result.qualityReport).toBeUndefined();
    fs.unlinkSync(file);
    observe.mockRestore();

    const blocked = jest.spyOn(runtime, 'observeBestepScoreImport');
    transaction.commit.mockRejectedValueOnce(new Error('commit failed'));
    const failing = writeBook([sheetRow('SYN1')]);
    await expect(importScoreData(failing, '114-2')).rejects.toThrow('commit failed');
    expect(transaction.rollback).toHaveBeenCalled();
    expect(blocked).not.toHaveBeenCalled();
    fs.unlinkSync(failing);
    blocked.mockRestore();
  });

  test('K1-08 K1-14 K1-15 parse and upsert failures stay on the import path', async () => {
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const observe = jest.spyOn(runtime, 'observeBestepScoreImport').mockImplementation(() => {
      throw new Error('student SYN1 shadow');
    });
    const file = writeBook([sheetRow('SYN1')]);
    const shadowed = await importScoreData(file, '114-2');
    expect(shadowed.imported).toBe(1);
    expect(shadowed.errors).toEqual([]);
    fs.unlinkSync(file);
    observe.mockRestore();

    const liveObserve = jest.spyOn(runtime, 'observeBestepScoreImport');
    readFile.mockImplementation(() => { throw new Error('parse failed SYN1'); });
    const unreadable = writeBook([sheetRow('SYN1')]);
    await expect(importScoreData(unreadable, '114-2')).rejects.toThrow('parse failed SYN1');
    expect(liveObserve).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    fs.unlinkSync(unreadable);
    liveObserve.mockRestore();

    readFile.mockRestore();
    readFile = jest.spyOn(XLSX, 'readFile');
    BestepExamScore.upsert.mockRejectedValue(new Error('upsert failed SYN1'));
    const offFile = writeBook([sheetRow('SYN1')]);
    delete process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED;
    const off = await importScoreData(offFile, '114-2');
    process.env.BESTEP_FILE_QUALITY_SHADOW_ENABLED = 'true';
    const onObserve = jest.spyOn(runtime, 'observeBestepScoreImport');
    const onFile = writeBook([sheetRow('SYN1')]);
    const on = await importScoreData(onFile, '114-2');
    expect(comparable(on)).toEqual(comparable(off));
    expect(on.imported).toBe(0);
    expect(on.skipped).toBe(1);
    expect(on.errors[0].error).toBe('PROCESSING_ERROR');
    expect(on.errors[0].message).toBe('upsert failed SYN1');
    expect(JSON.stringify(onObserve.mock.results[0].value)).not.toContain('SYN1');
    expect(transaction.commit).toHaveBeenCalled();
    fs.unlinkSync(offFile);
    fs.unlinkSync(onFile);
    onObserve.mockRestore();
  });
});
