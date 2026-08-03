const SUMMARY_KEY = 'eears_word_bridge_last_summary';
const PREFS_KEY = 'eears_word_bridge_style_prefs';

function readJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

/** @param {object} summary */
export function saveWordBridgeSummary(summary) {
  if (!summary) return;
  writeJson(SUMMARY_KEY, {
    ...summary,
    savedAt: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eears:word-bridge-summary-updated'));
  }
}

export function getWordBridgeSummary() {
  return readJson(SUMMARY_KEY);
}

/** @param {{ density: string, focus: string }} prefs */
export function saveWordBridgePreferences(prefs) {
  if (!prefs) return;
  writeJson(PREFS_KEY, prefs);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eears:word-bridge-prefs-updated'));
  }
}

export function getWordBridgePreferences() {
  return readJson(PREFS_KEY);
}

export function clearWordBridgeSession() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SUMMARY_KEY);
    sessionStorage.removeItem(PREFS_KEY);
  } catch {
    // ignore
  }
}
