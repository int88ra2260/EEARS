/**
 * Listening Ladder 場次儲存介面（MVP: localStorage；未來可替換為 API）
 */

const BEST_KEY = 'eears_listening_ladder_best';
const SESSIONS_KEY = 'eears_listening_ladder_sessions';

function readJson(key, fallback = null) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * @typedef {Object} ListeningLadderBestScore
 * @property {number} score
 * @property {number} accuracy
 * @property {string} highestLevelReached
 * @property {string} at
 */

/**
 * @param {{ score: number, accuracy: number, highestLevelReached: string }} result
 * @returns {Promise<void>}
 */
export async function saveBestScore(result) {
  const current = readJson(BEST_KEY, null);
  if (!current || result.score > current.score) {
    writeJson(BEST_KEY, {
      score: result.score,
      accuracy: result.accuracy,
      highestLevelReached: result.highestLevelReached,
      at: new Date().toISOString(),
    });
  }
}

/**
 * @returns {Promise<ListeningLadderBestScore|null>}
 */
export async function getBestScore() {
  return readJson(BEST_KEY, null);
}

/**
 * @param {object} session
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  const list = readJson(SESSIONS_KEY, []);
  writeJson(SESSIONS_KEY, [{ ...session, savedAt: new Date().toISOString() }, ...list].slice(0, 20));
}
