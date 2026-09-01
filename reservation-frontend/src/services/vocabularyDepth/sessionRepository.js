/**
 * Vocabulary Depth 場次儲存介面（MVP: localStorage；未來可替換為 API）
 */

const STORAGE_KEY = 'eears_vocabulary_depth_sessions';
const LATEST_KEY = 'eears_vocabulary_depth_latest';

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
    // quota / private mode
  }
}

/**
 * @typedef {Object} VocabularyDepthStoredSession
 * @property {string} traceId
 * @property {string} estimatedLevel
 * @property {number} accuracy
 * @property {number} durationMs
 * @property {string} completedAt
 * @property {object} [result]
 */

/**
 * @param {VocabularyDepthStoredSession} session
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  const list = readJson(STORAGE_KEY, []);
  const next = [{ ...session, savedAt: new Date().toISOString() }, ...list].slice(0, 20);
  writeJson(STORAGE_KEY, next);
  writeJson(LATEST_KEY, session);
}

/**
 * @returns {Promise<VocabularyDepthStoredSession|null>}
 */
export async function getLatestSession() {
  return readJson(LATEST_KEY, null);
}

/**
 * @returns {Promise<VocabularyDepthStoredSession[]>}
 */
export async function listSessions() {
  return readJson(STORAGE_KEY, []);
}

/**
 * @returns {Promise<void>}
 */
export async function clearSessions() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LATEST_KEY);
  } catch {
    // ignore
  }
}
