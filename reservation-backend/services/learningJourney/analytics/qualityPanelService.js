'use strict';

const { LjStudentEvent, LjAnalyticExam } = require('../../../models');
const {
  EVENT_STATUS,
  EVENT_TYPES,
} = require('../../../constants/learningJourneyEventConstants');
const { assertEventQuality, assertExamDeltaPair } = require('../utils/eventQualityAssertions');
const { resolveLatestSnapshotVersion } = require('./timelineReadService');

async function runQualityAssertions(opts = {}) {
  const snapshotVersion = opts.snapshotVersion || await resolveLatestSnapshotVersion();
  const events = await LjStudentEvent.findAll({ limit: 50000, order: [['id', 'ASC']] });
  const exams = await LjAnalyticExam.findAll({ where: { snapshotVersion }, limit: 50000 });

  const findings = [];
  let missingEventDate = 0;
  let registeredNoScoreWithScore = 0;
  let negativeSemIndex = 0;
  let zeroScoreValid = 0;
  let crossInstrumentDelta = 0;
  let beforeIncludesExamDay = 0;
  let excludedEventCount = 0;
  let registeredNoScoreCount = 0;

  const skillCoverage = { listening: 0, reading: 0, speaking: 0, writing: 0 };
  const instrumentSet = new Set();

  for (const ev of events) {
    const j = ev.toJSON();
    const issues = assertEventQuality(j);
    for (const issue of issues) {
      findings.push({ scope: 'event', eventId: j.id, studentId: j.studentId, ...issue });
    }
    if (!j.eventDate) missingEventDate += 1;
    if (j.status === EVENT_STATUS.REGISTERED_NO_SCORE && j.rawScore != null) registeredNoScoreWithScore += 1;
    if (j.semIndex != null && j.semIndex < 0 && j.timing !== 'entry') negativeSemIndex += 1;
    if (Number(j.rawScore) === 0 && j.status === EVENT_STATUS.VALID) zeroScoreValid += 1;
    if (j.excludeFlag) excludedEventCount += 1;
    if (j.status === EVENT_STATUS.REGISTERED_NO_SCORE) registeredNoScoreCount += 1;
    if (j.eventType === EVENT_TYPES.EXAM && j.skill) {
      skillCoverage[j.skill] = (skillCoverage[j.skill] || 0) + 1;
      if (j.instrument) instrumentSet.add(j.instrument);
    }
  }

  for (const exam of exams) {
    const j = exam.toJSON();
    if (j.previousExamEventId && j.deltaRawScore != null) {
      const prev = exams.find((e) => e.id === j.previousExamEventId);
      if (prev && prev.instrument !== j.instrument) {
        crossInstrumentDelta += 1;
        findings.push({
          scope: 'analytic_exam',
          examId: j.id,
          code: 'CROSS_INSTRUMENT_DELTA',
          message: `${prev.instrument} vs ${j.instrument}`,
          severity: 'error',
        });
      }
      const pairIssues = assertExamDeltaPair(j, prev?.toJSON());
      findings.push(...pairIssues.map((issue) => ({ scope: 'analytic_exam', examId: j.id, ...issue })));
    }
  }

  const totalEvents = events.length || 1;
  const totalExams = exams.length || 1;

  return {
    snapshotVersion,
    summary: {
      totalEvents: events.length,
      totalExams: exams.length,
      missingEventDateRate: Number((missingEventDate / totalEvents).toFixed(4)),
      registeredNoScoreRate: Number((registeredNoScoreCount / totalEvents).toFixed(4)),
      excludedEventRate: Number((excludedEventCount / totalEvents).toFixed(4)),
      skillCoverage: {
        listening: Number((skillCoverage.listening / totalExams).toFixed(4)),
        reading: Number((skillCoverage.reading / totalExams).toFixed(4)),
        speaking: Number((skillCoverage.speaking / totalExams).toFixed(4)),
        writing: Number((skillCoverage.writing / totalExams).toFixed(4)),
      },
      instrumentCoverage: [...instrumentSet],
      anomalies: {
        missingEventDate,
        registeredNoScoreWithScore,
        negativeSemIndex,
        zeroScoreValid,
        crossInstrumentDelta,
        beforeIncludesExamDay,
      },
    },
    findings: findings.slice(0, 200),
  };
}

module.exports = {
  runQualityAssertions,
};
