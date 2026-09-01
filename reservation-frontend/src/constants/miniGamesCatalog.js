/**
 * Mini Games 目錄卡片（Activities Hub 練習區）
 */
import { MINI_GAME_IDS } from './learningContentTypes';

/** @typedef {Object} MiniGameCatalogCard
 * @property {string} id
 * @property {string} path
 * @property {string} titleKey
 * @property {string} introKey
 * @property {string} tag
 * @property {string} tone
 * @property {boolean} [available]
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
