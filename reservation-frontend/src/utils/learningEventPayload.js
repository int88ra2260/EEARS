/**
 * 未來 LVA / Learning Journey 事件 payload（MVP 暫不送出）
 */

const SESSION_KEY = 'eears_learning_client_session';

function getClientSessionId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `ls_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `ls_${Date.now()}`;
  }
}

/**
 * @param {string} gameId
 * @param {object} result
 */
export function buildMiniGameCompletePayload(gameId, result) {
  return {
    source: 'eears_mini_game',
    gameId,
    completedAt: new Date().toISOString(),
    clientSessionId: getClientSessionId(),
    durationMs: result.durationMs ?? 0,
    score: result.score ?? 0,
    accuracy: result.accuracy ?? 0,
    highestLevelReached: result.highestLevelReached ?? null,
    correctCount: result.correctCount ?? 0,
    totalAnswered: result.totalAnswered ?? 0,
    skillTags: result.skillTags ?? ['listening_vocabulary'],
  };
}
