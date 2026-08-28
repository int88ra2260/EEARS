'use strict';

const dayjs = require('dayjs');
const { LjStudentEvent } = require('../../models');

const SOURCE_SYSTEM = 'eears_learning_trace';

async function projectTraceToLearningJourney(traceRow) {
  if (!traceRow || traceRow.eventType !== 'session_complete') return null;
  const studentId = traceRow.studentId || traceRow.payload?.studentId;
  if (!studentId) return null;

  const sourceRecordId = `trace:${traceRow.traceId}`;
  const existing = await LjStudentEvent.findOne({
    where: { sourceSystem: SOURCE_SYSTEM, sourceRecordId },
  });
  if (existing) {
    return { created: false, id: existing.id };
  }

  const row = await LjStudentEvent.create({
    studentId,
    eventType: 'micro_learning_event',
    eventDate: dayjs(traceRow.occurredAt).format('YYYY-MM-DD'),
    sourceSystem: SOURCE_SYSTEM,
    sourceRecordId,
    status: 'valid',
    cefrLevel: traceRow.cefrLevel || null,
    rawScore: traceRow.score != null ? traceRow.score : null,
    hours: traceRow.durationMs ? Number((traceRow.durationMs / 3600000).toFixed(2)) : null,
    title: `Micro learning · ${traceRow.gameId}`,
    subtitle: traceRow.payload?.endReason || null,
    rawPayload: {
      traceId: traceRow.traceId,
      gameId: traceRow.gameId,
      clientSessionId: traceRow.clientSessionId,
      ...(traceRow.payload || {}),
    },
  });

  return { created: true, id: row.id };
}

module.exports = {
  projectTraceToLearningJourney,
  SOURCE_SYSTEM,
};
