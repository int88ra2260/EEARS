const STORAGE_KEY = 'eears_listening_ladder_best';

/**
 * @returns {{ score: number, accuracy: number, highestLevelReached: string, at: string }|null}
 */
export function getListeningLadderBest() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ score: number, accuracy: number, highestLevelReached: string }} result
 */
export function saveListeningLadderBest(result) {
  if (typeof window === 'undefined') return;
  try {
    const current = getListeningLadderBest();
    if (!current || result.score > current.score) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        score: result.score,
        accuracy: result.accuracy,
        highestLevelReached: result.highestLevelReached,
        at: new Date().toISOString(),
      }));
    }
  } catch {
    // ignore quota errors
  }
}
