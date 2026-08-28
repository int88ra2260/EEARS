/**
 * 微學習軌跡事件 payload（Learning Trace Layer）
 */

import { getClientSessionId } from './learningTraceSession';
import { getVoluntaryStudentId } from './learningStudentLink';

/**
 * @param {string} gameId
 * @param {object} result - computeWordBridgeResult 回傳值
 * @param {object} summary - gameSummary
 */
export function buildMiniGameCompletePayload(gameId, result, summary = {}) {
  const totalAnswered = Number(summary.totalMistakes || 0)
    + (Array.isArray(summary.passedLevels) ? summary.passedLevels.length * 4 : 0);
  const correctCount = Math.max(0, totalAnswered - Number(summary.totalMistakes || 0));
  const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : null;

  return {
    traceId: summary.traceId,
    gameId,
    eventType: 'session_complete',
    clientSessionId: getClientSessionId(),
    studentId: summary.studentId || getVoluntaryStudentId() || undefined,
    occurredAt: new Date().toISOString(),
    durationMs: summary.durationMs ?? 0,
    score: Array.isArray(summary.passedLevels) ? summary.passedLevels.length : 0,
    accuracy,
    cefrLevel: result?.estimatedLevel ?? null,
    skillTags: result?.stats?.skillTags ?? ['listening_vocabulary', 'vocabulary'],
    payload: {
      endReason: summary.endReason,
      failLevel: summary.failLevel,
      passedLevels: summary.passedLevels ?? [],
      totalMistakes: summary.totalMistakes ?? 0,
      mistakeLog: summary.mistakeLog ?? [],
      confidence: result?.confidence ?? null,
      recommendedActivities: result?.activities ?? [],
      stats: result?.stats ?? null,
    },
  };
}

/** @param {string} gameId @param {object} summary */
export function buildMiniGameStartPayload(gameId, summary = {}) {
  return {
    traceId: summary.traceId,
    gameId,
    eventType: 'session_start',
    clientSessionId: getClientSessionId(),
    studentId: summary.studentId || getVoluntaryStudentId() || undefined,
    occurredAt: new Date().toISOString(),
    payload: {
      startLevel: summary.startLevel || null,
    },
  };
}
export function buildLegacyMiniGamePayload(gameId, result) {
  return buildMiniGameCompletePayload(gameId, result, {
    traceId: `legacy_${Date.now()}`,
    durationMs: result.durationMs ?? 0,
    endReason: result.stats?.endReason,
    passedLevels: result.stats?.passedLevels ?? [],
    totalMistakes: result.stats?.totalMistakes ?? 0,
  });
}
