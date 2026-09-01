/**
 * 微學習軌跡事件 payload（Learning Trace Layer）
 */

import { getClientSessionId } from './learningTraceSession';
import { getVoluntaryStudentId } from './learningStudentLink';
import { getActivityKeysForCefrLevel } from './wordBridgeRecommendations';

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

/** @param {object} summary Listening Ladder session summary */
export function buildListeningLadderCompletePayload(summary) {
  const totalAnswered = Number(summary.totalAnswered || 0);
  const correctCount = Number(summary.correctCount || 0);
  const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : summary.accuracy ?? null;

  return {
    traceId: summary.traceId,
    gameId: 'listening_ladder',
    eventType: 'session_complete',
    clientSessionId: getClientSessionId(),
    studentId: summary.studentId || getVoluntaryStudentId() || undefined,
    occurredAt: new Date().toISOString(),
    durationMs: summary.durationMs ?? 0,
    score: summary.score ?? 0,
    accuracy,
    cefrLevel: summary.highestLevelReached ?? null,
    skillTags: ['listening_vocabulary', 'listening'],
    payload: {
      endReason: 'time_up',
      highestLevelReached: summary.highestLevelReached,
      correctCount: summary.correctCount,
      totalAnswered: summary.totalAnswered,
      bestStreak: summary.bestStreak,
      recommendedActivities: getActivityKeysForCefrLevel(summary.highestLevelReached || 'A1'),
    },
  };
}

/** @param {object} result vocabulary depth result */
/** @param {object} summary session summary */
export function buildVocabularyDepthCompletePayload(result, summary) {
  const totalAnswered = Number(summary.totalAnswered || 0);
  const correctCount = Number(summary.totalCorrect || 0);
  const accuracy = totalAnswered > 0 ? correctCount / totalAnswered : result?.accuracy ?? null;

  return {
    traceId: summary.traceId,
    gameId: 'vocabulary_depth',
    eventType: 'session_complete',
    clientSessionId: getClientSessionId(),
    studentId: summary.studentId || getVoluntaryStudentId() || undefined,
    occurredAt: new Date().toISOString(),
    durationMs: summary.durationMs ?? 0,
    score: Array.isArray(summary.passedLevels) ? summary.passedLevels.length : 0,
    accuracy,
    cefrLevel: result?.estimatedLevel ?? null,
    skillTags: ['vocabulary', 'vocabulary_depth', 'reading_comprehension'],
    payload: {
      endReason: summary.endReason,
      failLevel: summary.failLevel,
      passedLevels: summary.passedLevels ?? [],
      levelStats: summary.levelStats ?? [],
      confidence: result?.confidence ?? null,
      recommendedActivities: getActivityKeysForCefrLevel(result?.estimatedLevel || 'A1'),
      stats: result?.stats ?? null,
    },
  };
}

/** @param {object} result vocabulary size result */
/** @param {object} summary session summary */
export function buildVocabularySizeCompletePayload(result, summary) {
  const totalKnown = Number(summary.totalKnown || 0);
  const totalSampled = Number(summary.totalSampled || 0);
  const recognition = totalSampled > 0 ? totalKnown / totalSampled : result?.recognitionRate ?? null;

  return {
    traceId: summary.traceId,
    gameId: 'vocabulary_size',
    eventType: 'session_complete',
    clientSessionId: getClientSessionId(),
    studentId: summary.studentId || getVoluntaryStudentId() || undefined,
    occurredAt: new Date().toISOString(),
    durationMs: summary.durationMs ?? 0,
    score: result?.estimatedWords ?? 0,
    accuracy: recognition,
    cefrLevel: result?.estimatedLevel ?? null,
    skillTags: ['vocabulary', 'vocabulary_size', 'lexical_breadth'],
    payload: {
      endReason: result?.endReason ?? 'completed',
      estimatedWords: result?.estimatedWords ?? null,
      recognitionRate: result?.recognitionRate ?? recognition,
      wordsToNextLevel: result?.wordsToNextLevel ?? null,
      bandStats: result?.bandStats ?? [],
      recommendedActivities: getActivityKeysForCefrLevel(result?.estimatedLevel || 'A1'),
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
