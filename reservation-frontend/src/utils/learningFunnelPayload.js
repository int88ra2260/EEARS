import { getClientSessionId } from '../utils/learningTraceSession';

function createFunnelTraceId(prefix = 'funnel') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildActivityFunnelPayload({
  eventType,
  activityKey,
  batchId,
  source = 'word_bridge_results',
  studentId = null,
  estimatedLevel = null,
}) {
  const traceId = createFunnelTraceId(`af_${activityKey || 'unknown'}`);
  return {
    traceId,
    gameId: 'activity_recommendation',
    eventType,
    clientSessionId: getClientSessionId(),
    studentId: studentId || undefined,
    occurredAt: new Date().toISOString(),
    payload: {
      activityKey,
      batchId,
      source,
      estimatedLevel,
    },
  };
}

export function createRecommendationBatchId() {
  return createFunnelTraceId('batch');
}
