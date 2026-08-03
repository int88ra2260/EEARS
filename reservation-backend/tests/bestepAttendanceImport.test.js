const assert = require('node:assert/strict');
const { buildBestepAttendanceRecords, parseExamItems } = require('../services/bestepImportService');

const baseParams = {
  requestedExamType: null,
  semester: '114-1',
  examDate: '2026-05-01',
  studentId: 'B146090018',
  sourceFile: 'test.xlsx',
  importBatchId: 'test-batch'
};

test('parseExamItems splits LR,S,W style cells', () => {
  assert.deepEqual(parseExamItems('LR,S,W'), ['LR', 'S', 'W']);
});

test('buildBestepAttendanceRecords reads L/R absent columns from official template', () => {
  const row = {
    學號: 'B146090018',
    姓名: '郭家軒',
    報考項目: 'LR,S,W',
    'L出缺席': '缺席',
    'R出缺席': '缺席',
    'S出缺席': '缺席',
    'W出缺席': '缺席'
  };

  const records = buildBestepAttendanceRecords({ ...baseParams, row });
  const byType = Object.fromEntries(records.map((r) => [r.examType, r]));

  assert.equal(byType.L.attended, false);
  assert.equal(byType.R.attended, false);
  assert.equal(byType.S.attended, false);
  assert.equal(byType.W.attended, false);
  assert.equal(byType.LR.attended, false);
  assert.equal(byType.SW.attended, false);
});

test('buildBestepAttendanceRecords defaults L/R to attended when columns missing (legacy)', () => {
  const row = {
    學號: 'B146090018',
    應考項目: 'LR',
    出席狀態: '缺席'
  };

  const records = buildBestepAttendanceRecords({ ...baseParams, row });
  const byType = Object.fromEntries(records.map((r) => [r.examType, r]));

  assert.equal(byType.L.attended, false);
  assert.equal(byType.R.attended, false);
  assert.equal(byType.LR.attended, false);
});

test('buildBestepAttendanceRecords applies legacy attended column for SW', () => {
  const row = {
    學號: 'B146090018',
    應考項目: 'SW',
    出席狀態: '缺席'
  };

  const records = buildBestepAttendanceRecords({
    ...baseParams,
    requestedExamType: 'SW',
    row
  });
  const byType = Object.fromEntries(records.map((r) => [r.examType, r]));

  assert.equal(byType.S.attended, false);
  assert.equal(byType.W.attended, false);
  assert.equal(byType.SW.attended, false);
});
