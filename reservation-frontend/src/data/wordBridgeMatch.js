import { buildMistakeWordRows } from './wordBridgeGlossary';

/** 每輪 8 組中英配對 = 16 張卡 */
export const MATCH_PAIRS_PER_ROUND = 8;

/** 至少 4 組 B1+ 錯誤單字才顯示配對 */
export const MATCH_MIN_PAIRS_TO_START = 4;

const B1_PLUS_LEVELS = new Set(['B1', 'B2', 'C1', 'C2']);

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * @param {Array<{ level: string, reason: string, words: string[] }>} mistakeLog
 */
export function buildB1PlusMistakeWords(mistakeLog) {
  return buildMistakeWordRows(mistakeLog).filter((row) => B1_PLUS_LEVELS.has(row.level));
}

/**
 * @param {Array<{ en: string }>} rows
 */
export function canStartWordBridgeMatch(rows) {
  return Array.isArray(rows) && rows.length >= MATCH_MIN_PAIRS_TO_START;
}

/**
 * @param {Array<{ en: string, zh: string|null, level: string }>} allWords
 * @param {Set<string>} masteredSet
 */
export function pickMatchRoundPairs(allWords, masteredSet) {
  const unmatched = allWords.filter((word) => !masteredSet.has(word.en));
  if (unmatched.length === 0) {
    return { pairs: [], complete: true };
  }

  const goal = Math.min(MATCH_PAIRS_PER_ROUND, allWords.length);
  const usedEn = new Set();

  if (unmatched.length >= MATCH_PAIRS_PER_ROUND) {
    return { pairs: shuffleArray(unmatched).slice(0, MATCH_PAIRS_PER_ROUND), complete: false };
  }

  /** @type {Array<{ en: string, zh: string|null, level: string, isReview?: boolean }>} */
  let selected = [...unmatched];
  selected.forEach((word) => usedEn.add(word.en));

  const fillFromMastered = (targetCount) => {
    const reviewPool = shuffleArray(
      allWords.filter((word) => masteredSet.has(word.en) && !usedEn.has(word.en)),
    );
    for (const word of reviewPool) {
      if (selected.length >= targetCount) break;
      selected.push({ ...word, isReview: true });
      usedEn.add(word.en);
    }
  };

  if (selected.length < goal) {
    fillFromMastered(goal);
  }

  if (unmatched.length < MATCH_MIN_PAIRS_TO_START) {
    const minGoal = Math.min(MATCH_MIN_PAIRS_TO_START, allWords.length);
    if (selected.length < minGoal) {
      fillFromMastered(minGoal);
    }
  }

  return { pairs: shuffleArray(selected), complete: false };
}

/**
 * @param {Array<{ en: string, zh: string|null, level: string, isReview?: boolean }>} pairs
 */
export function pairsToMatchCards(pairs) {
  const cards = [];
  pairs.forEach((pair) => {
    cards.push({
      id: `${pair.en}-en`,
      pairKey: pair.en,
      text: pair.en,
      side: 'en',
      level: pair.level,
      isReview: Boolean(pair.isReview),
    });
    cards.push({
      id: `${pair.en}-zh`,
      pairKey: pair.en,
      text: pair.zh || pair.en,
      side: 'zh',
      level: pair.level,
      isReview: Boolean(pair.isReview),
    });
  });
  return shuffleArray(cards);
}
