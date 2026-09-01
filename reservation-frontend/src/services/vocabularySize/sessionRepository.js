/**
 * Vocabulary Size 場次儲存（MVP：localStorage；日後可換 API）
 */

const STORAGE_KEY = 'eears_vocabulary_size_sessions';
const LATEST_KEY = 'eears_vocabulary_size_latest';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @typedef {Object} VocabularySizeStoredSession
 * @property {string} traceId
 * @property {number} estimatedWords
 * @property {string} estimatedLevel
 * @property {number} recognitionRate
 * @property {number} durationMs
 * @property {string} completedAt
 * @property {object} result
 */

/**
 * @param {VocabularySizeStoredSession} session
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  const list = readJson(STORAGE_KEY, []);
  list.unshift(session);
  writeJson(STORAGE_KEY, list.slice(0, 20));
  writeJson(LATEST_KEY, session);
}

/**
 * @returns {Promise<VocabularySizeStoredSession|null>}
 */
export async function loadLatestSession() {
  return readJson(LATEST_KEY, null);
}

/**
 * @returns {Promise<VocabularySizeStoredSession[]>}
 */
export async function loadSessionHistory() {
  return readJson(STORAGE_KEY, []);
}
