/**
 * Listening Ladder 題庫（聽英文、選中文，A1–C1，每級 30 題）
 * 詞彙 CEFR 以 canonical vocabulary bank 為準。
 */

import { LISTENING_LADDER_LEVELS } from '../../constants/learningContentTypes';
import { RAW_LISTENING_WORDS } from './listeningLadderWords.js';
import { getCanonicalEntry } from './vocabulary/index.js';

/** @typedef {import('../../constants/learningContentTypes').ListeningLadderLevel} CefrLevel */

/**
 * @typedef {Object} ListeningLadderItem
 * @property {string} id
 * @property {string} word
 * @property {string} audioText
 * @property {string|null} audioUrl
 * @property {string} level
 * @property {string} partOfSpeech
 * @property {string} topic
 * @property {string[]} questionTypes
 * @property {{ sound_match: string, synonym?: string[], definition?: string }} correctOptions
 * @property {{ sound_match: string[], synonym?: string[], definition?: string[] }} distractors
 * @property {string} exampleSentence
 * @property {string} translationZh
 * @property {string[]} tags
 * @property {string} skillTag
 * @property {string} subSkill
 * @property {boolean} isActive
 */

const EXAMPLE_SENTENCES = {
  participate: 'Students are encouraged to participate in English Table.',
  reservation: 'Please make a reservation before the activity starts.',
  articulate: 'Try to articulate your ideas clearly during the discussion.',
  hypothesis: 'The speaker presented a hypothesis about global education trends.',
};

function buildItem(raw, index) {
  const id = `ll_${String(index + 1).padStart(4, '0')}`;
  const word = raw.word;
  const canonical = getCanonicalEntry(word);
  const level = canonical?.level ?? raw.level;
  const zh = canonical?.zh ?? raw.zh;
  return {
    id,
    word,
    audioText: word,
    audioUrl: null,
    level,
    partOfSpeech: raw.pos,
    topic: raw.topic,
    questionTypes: ['zh_match'],
    correctOptions: {
      sound_match: zh,
      synonym: [],
      definition: '',
    },
    distractors: {
      sound_match: [],
      synonym: [],
      definition: [],
    },
    exampleSentence: EXAMPLE_SENTENCES[word] || `Example: ${word}.`,
    translationZh: zh,
    tags: [level, raw.topic],
    skillTag: 'listening_vocabulary',
    subSkill: 'word_recognition',
    isActive: true,
  };
}

/** @type {ListeningLadderItem[]} */
export const LISTENING_LADDER_ITEMS = RAW_LISTENING_WORDS.map(buildItem);

/**
 * @param {{ level?: string, topic?: string }} [filters]
 */
export function getListeningLadderItems(filters = {}) {
  return LISTENING_LADDER_ITEMS.filter((item) => {
    if (!item.isActive) return false;
    if (filters.level && item.level !== filters.level) return false;
    if (filters.topic && item.topic !== filters.topic) return false;
    return true;
  });
}

/**
 * @param {unknown[]} arr
 */
export function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 聽英文單字，四選一中文翻譯（干擾項取自同級其他題目）
 * @param {ListeningLadderItem} item
 */
export function buildSoundMatchOptions(item) {
  const correct = item.translationZh;
  const wrongPool = getListeningLadderItems({ level: item.level })
    .filter((other) => other.id !== item.id && other.translationZh !== correct)
    .map((other) => other.translationZh);
  const uniqueWrong = [...new Set(wrongPool)];
  const wrong = shuffleArray(uniqueWrong).slice(0, 3);

  return shuffleArray([correct, ...wrong]).map((text, index) => ({
    id: `${item.id}_opt_${index}`,
    text,
    isCorrect: text === correct,
  }));
}

/**
 * @param {{ level: string, excludeIds?: string[] }} opts
 */
export function pickQuestion({ level, excludeIds = [] }) {
  const pool = getListeningLadderItems({ level }).filter((item) => !excludeIds.includes(item.id));
  if (pool.length === 0) {
    const fallback = getListeningLadderItems({ level });
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * @param {string} level
 * @param {string} highestSoFar
 */
export function maxLevel(level, highestSoFar) {
  const order = [...LISTENING_LADDER_LEVELS];
  return order.indexOf(level) > order.indexOf(highestSoFar) ? level : highestSoFar;
}

/** @param {string} level */
export function countItemsByLevel(level) {
  return getListeningLadderItems({ level }).length;
}
