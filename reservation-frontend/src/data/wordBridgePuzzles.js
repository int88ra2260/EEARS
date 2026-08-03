/**
 * 語彙連橋（Word Bridge）階梯測驗邏輯。
 * 題庫見 wordBridgeThemes.js（每難度 25 主題 × 4 詞）。
 */

import { THEMES_PER_LEVEL, WORD_BRIDGE_THEME_BANKS } from './wordBridgeThemes';

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const THEME_BANK_LEVELS = Object.keys(WORD_BRIDGE_THEME_BANKS);

export const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };

export const MAX_MISTAKES = 5;

/** 每難度一輪限時（秒） */
export const ROUND_SECONDS_BY_LEVEL = {
  A1: 40,
  A2: 60,
  B1: 80,
  B2: 90,
  C1: 100,
  C2: 110,
};

export function getRoundSecondsForLevel(level) {
  return ROUND_SECONDS_BY_LEVEL[level] ?? ROUND_SECONDS_BY_LEVEL.A2;
}

/** 每難度一輪顯示的主題組數 */
export const QUARTETS_PER_LEVEL = {
  A1: 2,
  A2: 3,
  B1: 4,
  B2: 4,
  C1: 4,
  C2: 4,
};

export function getQuartetCountForLevel(level) {
  return QUARTETS_PER_LEVEL[level] ?? 4;
}

function normalizeThemeBank() {
  /** @type {Record<string, Array<{ id: string, sourceId: string, theme: string, level: string, words: string[] }>>} */
  const banks = {};
  CEFR_LEVELS.forEach((level) => {
    banks[level] = (WORD_BRIDGE_THEME_BANKS[level] || []).map((item) => ({
      id: item.id,
      sourceId: item.id,
      theme: item.theme,
      level,
      words: [...item.words],
    }));
  });
  return banks;
}

export const WORD_LEVEL_BANKS = normalizeThemeBank();

export function validateThemeBanks(banks = WORD_LEVEL_BANKS) {
  const issues = [];
  const levels = Object.keys(WORD_BRIDGE_THEME_BANKS);
  levels.forEach((level) => {
    const themes = banks[level] || WORD_BRIDGE_THEME_BANKS[level] || [];
    if (themes.length !== THEMES_PER_LEVEL) {
      issues.push(`${level}: expected ${THEMES_PER_LEVEL} themes, got ${themes.length}`);
    }
    const words = themes.flatMap((theme) => theme.words);
    if (words.length !== themes.length * 4) {
      issues.push(`${level}: invalid word counts`);
    }
    const seen = new Set();
    words.forEach((word) => {
      if (seen.has(word)) issues.push(`${level}: duplicate word "${word}"`);
      seen.add(word);
    });
  });
  return issues;
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickQuartets(bank, excludeIds, count) {
  const exclude = new Set(excludeIds);
  let pool = bank.filter((item) => !exclude.has(item.id));
  if (pool.length < count) {
    pool = [...bank];
  }
  return shuffleArray(pool).slice(0, Math.min(count, pool.length));
}

function quartetsToTiles(quartets, level, roundId, idStamp = '') {
  const tiles = [];
  quartets.forEach((quartet) => {
    quartet.words.forEach((word) => {
      tiles.push({
        id: `${roundId}-${quartet.id}-${word}${idStamp}`,
        word,
        level,
        quartetId: quartet.id,
        theme: quartet.theme,
        sourceId: quartet.sourceId,
      });
    });
  });
  return tiles;
}

/**
 * 建立單一難度的一輪題目。
 * @param {string} level
 * @param {string[]} usedQuartetIds
 */
/**
 * 依指定主題 ID 建立週報用的一輪題目（固定 4 組）。
 * @param {string} level
 * @param {string[]} themeIds — 須為 4 個有效主題 ID
 */
export function buildWeeklyRound(level, themeIds = []) {
  const bank = WORD_LEVEL_BANKS[level] || [];
  const byId = new Map(bank.map((item) => [item.id, item]));
  const quartets = themeIds.map((id) => {
    const found = byId.get(id);
    if (!found) {
      throw new Error(`Unknown word bridge theme: ${id}`);
    }
    return {
      id: found.id,
      sourceId: found.id,
      theme: found.theme,
      level,
      words: [...found.words],
    };
  });
  if (quartets.length !== 4) {
    throw new Error('Weekly round requires exactly 4 theme IDs');
  }
  const roundId = `weekly-${level}-${themeIds.join('-')}`;
  return {
    id: roundId,
    level,
    quartets,
    quartetIds: quartets.map((item) => item.id),
    tiles: shuffleArray(quartetsToTiles(quartets, level, roundId)),
  };
}

export function buildLevelRound(level, usedQuartetIds = []) {
  const count = getQuartetCountForLevel(level);
  const bank = WORD_LEVEL_BANKS[level] || [];
  const quartets = pickQuartets(bank, usedQuartetIds, count);
  const roundId = `${level}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id: roundId,
    level,
    quartets,
    quartetIds: quartets.map((item) => item.id),
    tiles: shuffleArray(quartetsToTiles(quartets, level, roundId)),
  };
}

/**
 * 錯誤後僅替換尚未答對的主題組，保留已答對詞彙。
 */
export function refreshUnsolvedQuartets({
  level,
  roundId,
  usedQuartetIds = [],
  solvedQuartetIds = [],
  lockedTiles = [],
}) {
  const totalNeeded = getQuartetCountForLevel(level);
  const unsolvedCount = totalNeeded - solvedQuartetIds.length;

  if (unsolvedCount <= 0) {
    return {
      newQuartetIds: [],
      tiles: lockedTiles,
      activeQuartetIds: [...solvedQuartetIds],
    };
  }

  const exclude = new Set([...usedQuartetIds, ...solvedQuartetIds]);
  const bank = WORD_LEVEL_BANKS[level] || [];
  const newQuartets = pickQuartets(bank, [...exclude], unsolvedCount);
  const idStamp = `-r${Date.now().toString(36)}`;
  const newTiles = quartetsToTiles(newQuartets, level, roundId, idStamp);

  return {
    newQuartetIds: newQuartets.map((item) => item.id),
    tiles: shuffleArray([...lockedTiles, ...newTiles]),
    activeQuartetIds: [...solvedQuartetIds, ...newQuartets.map((item) => item.id)],
  };
}

/**
 * @param {{ quartetId: string }[]} selected
 * @returns {string | null}
 */
export function resolveGroupQuartet(selected) {
  if (selected.length !== 4) return null;
  const quartetId = selected[0].quartetId;
  return selected.every((tile) => tile.quartetId === quartetId) ? quartetId : null;
}

export function getEstimatedLevelOnFailure(failLevel) {
  const rank = LEVEL_RANK[failLevel] || 1;
  if (rank <= 1) return 'A1';
  const targetRank = rank - 1;
  return CEFR_LEVELS.find((level) => LEVEL_RANK[level] === targetRank) || 'A1';
}

/**
 * @param {{
 *   endReason: 'mistakes' | 'cleared_c1' | 'cleared_c2',
 *   failLevel?: string,
 *   passedLevels?: string[],
 *   totalMistakes: number,
 * }} summary
 */
export function computeWordBridgeResult(summary) {
  const {
    endReason,
    failLevel = 'A1',
    passedLevels = [],
    totalMistakes,
    durationMs = 0,
  } = summary;

  let estimatedLevel = 'A1';
  if (endReason === 'cleared_c2') {
    estimatedLevel = 'C2';
  } else if (endReason === 'cleared_c1') {
    estimatedLevel = 'C1';
  } else if (endReason === 'mistakes') {
    estimatedLevel = getEstimatedLevelOnFailure(failLevel);
  } else if (passedLevels.length > 0) {
    estimatedLevel = passedLevels[passedLevels.length - 1];
  }

  const activities = [];
  if (estimatedLevel === 'A1') {
    activities.push('english-table');
  } else if (estimatedLevel === 'A2') {
    activities.push('english-table', 'english-club');
  } else if (estimatedLevel === 'B1') {
    activities.push('english-club', 'english-table', 'international-forum');
  } else if (estimatedLevel === 'B2') {
    activities.push('international-forum', 'english-club', 'job-talk');
  } else {
    activities.push('international-forum', 'job-talk', 'english-club');
  }

  const confidence =
    totalMistakes <= 2 && passedLevels.length >= 3 ? 'high' :
    totalMistakes <= 4 ? 'medium' : 'low';

  return {
    estimatedLevel,
    activities: [...new Set(activities)],
    confidence,
    stats: {
      passedLevels,
      failLevel: endReason === 'mistakes' ? failLevel : null,
      totalMistakes,
      maxMistakes: MAX_MISTAKES,
      durationMs,
      endReason,
    },
  };
}
