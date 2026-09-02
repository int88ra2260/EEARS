/**
 * Mini Games 目錄卡片（Learning Resources 微練習區）
 */
import { MINI_GAME_IDS } from './learningContentTypes';

/** @typedef {Object} MiniGameCatalogCard
 * @property {string} id
 * @property {string} path
 * @property {string} titleKey
 * @property {string} introKey
 * @property {string} tag
 * @property {string} tone
 * @property {string} [timeKey]
 * @property {boolean} [available]
 */

/** @typedef {Object} LearningResourceMiniGameRow
 * @property {number|string} [id]
 * @property {string|null} [titleZh]
 * @property {string|null} [titleEn]
 * @property {string|null} [introZh]
 * @property {string|null} [introEn]
 * @property {string|null} [tag]
 * @property {string} [href]
 * @property {boolean} [isExternal]
 * @property {string|null} [titleKey]
 * @property {string|null} [introKey]
 * @property {number} [sortOrder]
 * @property {boolean} [isActive]
 */

/** @type {MiniGameCatalogCard[]} */
export const MINI_GAMES_CATALOG = [
  {
    id: MINI_GAME_IDS.WORD_BRIDGE,
    path: '/practice/word-bridge',
    titleKey: 'wordBridge.title',
    introKey: 'miniGames.wordBridgeIntro',
    timeKey: 'miniGames.wordBridgeTime',
    tag: 'Vocabulary',
    tone: 'blue',
    available: true,
  },
  {
    id: MINI_GAME_IDS.LISTENING_LADDER,
    path: '/practice/listening-ladder',
    titleKey: 'listeningLadder.title',
    introKey: 'miniGames.listeningLadderIntro',
    timeKey: 'miniGames.listeningLadderTime',
    tag: 'Listening',
    tone: 'green',
    available: true,
  },
  {
    id: MINI_GAME_IDS.VOCABULARY_DEPTH,
    path: '/practice/vocabulary-depth',
    titleKey: 'vocabularyDepth.title',
    introKey: 'miniGames.vocabularyDepthIntro',
    timeKey: 'miniGames.vocabularyDepthTime',
    tag: 'Vocabulary',
    tone: 'purple',
    available: true,
  },
  {
    id: MINI_GAME_IDS.VOCABULARY_SIZE,
    path: '/practice/vocabulary-size',
    titleKey: 'vocabularySize.title',
    introKey: 'miniGames.vocabularySizeIntro',
    timeKey: 'miniGames.vocabularySizeTime',
    tag: 'Vocabulary',
    tone: 'yellow',
    available: true,
  },
];

const LEGACY_MINI_GAME_HREFS = {
  '/activities/word-bridge': '/practice/word-bridge',
  '/activities/games/listening-ladder': '/practice/listening-ladder',
  '/activities/games/vocabulary-depth': '/practice/vocabulary-depth',
  '/activities/games/vocabulary-size': '/practice/vocabulary-size',
};

function catalogCardToDisplayRow(card, sortOrder) {
  return {
    id: card.id,
    titleZh: null,
    titleEn: null,
    introZh: null,
    introEn: null,
    tag: card.tag,
    href: card.path,
    isExternal: false,
    titleKey: card.titleKey,
    introKey: card.introKey,
    sortOrder,
    isActive: true,
  };
}

/**
 * 合併後台 CMS 列與前端 catalog：補齊新微練習、修正舊 activities 路徑。
 * @param {LearningResourceMiniGameRow[]|null|undefined} apiRows
 * @returns {LearningResourceMiniGameRow[]}
 */
export function mergeLearningResourceMiniGames(apiRows) {
  const catalog = MINI_GAMES_CATALOG.filter((c) => c.available);
  const catalogByTitleKey = new Map(catalog.map((c) => [c.titleKey, c]));

  if (!Array.isArray(apiRows) || apiRows.length === 0) {
    return catalog.map((c, idx) => catalogCardToDisplayRow(c, idx));
  }

  const activeRows = apiRows.filter((row) => row.isActive !== false);
  const seenTitleKeys = new Set();
  const merged = activeRows.map((row, index) => {
    if (row.titleKey) seenTitleKeys.add(row.titleKey);
    const catalogCard = row.titleKey ? catalogByTitleKey.get(row.titleKey) : null;
    const href = catalogCard?.path
      || LEGACY_MINI_GAME_HREFS[row.href]
      || row.href
      || catalogCard?.path;

    return {
      ...row,
      id: row.id ?? row.titleKey ?? `mini-game-${index}`,
      tag: row.tag || catalogCard?.tag || 'Practice',
      href,
      isExternal: !!row.isExternal,
      titleKey: row.titleKey || catalogCard?.titleKey || null,
      introKey: row.introKey || catalogCard?.introKey || null,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : index,
      isActive: row.isActive !== false,
    };
  });

  let nextSort = merged.length;
  for (const card of catalog) {
    if (seenTitleKeys.has(card.titleKey)) continue;
    merged.push(catalogCardToDisplayRow(card, nextSort));
    nextSort += 1;
  }

  return merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
