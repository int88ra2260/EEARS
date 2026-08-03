const assert = require('node:assert/strict');
const {
  expandRegistrationToComponents,
  computeClassBestepExportSummary,
  computeStudentExamCount,
  resolveComponentAttended,
  resolveDomesticExportStatus,
  getExportRegistrationDisplay
} = require('../services/bestepClassService');

function domesticStudent(overrides = {}) {
  return {
    isDomesticForStats: true,
    showNonDomesticNote: false,
    attendance: {},
    personalRegistration: null,
    ...overrides
  };
}

test('expandRegistrationToComponents maps exam types to atomic parts', () => {
  assert.deepEqual(expandRegistrationToComponents('LRSW'), ['L', 'R', 'S', 'W']);
  assert.deepEqual(expandRegistrationToComponents('LR'), ['L', 'R']);
  assert.deepEqual(expandRegistrationToComponents('SW'), ['S', 'W']);
  assert.deepEqual(expandRegistrationToComponents('NON'), []);
});

test('resolveComponentAttended falls back to LR/SW composite records', () => {
  const attendance = {
    LR: { attended: false },
    SW: { attended: true }
  };
  assert.equal(resolveComponentAttended(attendance, 'L'), false);
  assert.equal(resolveComponentAttended(attendance, 'R'), false);
  assert.equal(resolveComponentAttended(attendance, 'S'), true);
  assert.equal(resolveComponentAttended(attendance, 'W'), true);
});

test('getExportRegistrationDisplay covers success, not registered, and failed', () => {
  assert.equal(
    getExportRegistrationDisplay({ status: 'success', examType: 'LR' }),
    '聽讀'
  );
  assert.equal(getExportRegistrationDisplay(null), '未報名');
  assert.equal(getExportRegistrationDisplay({ status: 'failed', examType: 'LR' }), '報名失敗');
});

test('computeStudentExamCount includes registration and approved exemption', () => {
  assert.equal(
    computeStudentExamCount({
      status: 'success',
      examType: 'LR',
      exemption_review_status: 'approved',
      exemptionVerifiedType: 'SW'
    }),
    4
  );
});

test('resolveDomesticExportStatus uses roster membership and isDomestic flag', () => {
  const rosterMap = new Map([
    ['S001', { isDomestic: true }],
    ['S002', { isDomestic: false }]
  ]);
  assert.equal(resolveDomesticExportStatus('s001', rosterMap).isDomesticForStats, true);
  assert.equal(resolveDomesticExportStatus('S003', rosterMap).showNonDomesticNote, true);
  assert.equal(resolveDomesticExportStatus('S002', rosterMap).showNonDomesticNote, true);
});

test('computeClassBestepExportSummary uses domestic roster rules for rates', () => {
  const students = [
    domesticStudent({
      personalRegistration: { status: 'success', examType: 'LR' },
      attendance: { L: { attended: true }, R: { attended: true } }
    }),
    domesticStudent({
      personalRegistration: { status: 'success', examType: 'SW' },
      attendance: { S: { attended: true }, W: { attended: false } }
    }),
    domesticStudent({
      personalRegistration: { status: 'failed', examType: 'LR' },
      attendance: {}
    }),
    {
      isDomesticForStats: false,
      showNonDomesticNote: true,
      personalRegistration: { status: 'success', examType: 'LRSW' },
      attendance: {}
    }
  ];

  const summary = computeClassBestepExportSummary(students);
  assert.equal(summary.enrolledCount, 3);
  assert.equal(summary.registeredCount, 2);
  assert.equal(summary.registrationSlots, 4);
  assert.equal(summary.attendedSlots, 3);
  assert.equal(summary.fullAttendanceCount, 1);
  assert.equal(summary.registrationRate, 50);
  assert.equal(summary.attendanceRate, 75);
  assert.equal(summary.lrAttendanceRate, 100);
  assert.equal(summary.sAttendanceRate, 100);
  assert.equal(summary.wAttendanceRate, 0);
  assert.equal(summary.registrationDenominator, 8);
});

test('computeClassBestepExportSummary excludes registration failed from registration rate numerator', () => {
  const students = [
    domesticStudent({
      personalRegistration: {
        status: 'failed',
        examType: 'LR',
        exemption_review_status: 'approved',
        exemptionVerifiedType: 'LR'
      },
      attendance: {}
    }),
    domesticStudent({
      personalRegistration: { status: 'success', examType: 'LR' },
      attendance: { L: { attended: true }, R: { attended: true } }
    })
  ];

  const summary = computeClassBestepExportSummary(students);
  assert.equal(summary.registrationSlots, 2);
  assert.equal(summary.registrationDenominator, 4);
  assert.equal(summary.registrationRate, 50);
});
