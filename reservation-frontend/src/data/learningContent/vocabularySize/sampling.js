import { FREQUENCY_BANDS, WORDS_PER_BAND } from './constants';
import { getWordsForBand } from './frequencyBank';

/**
 * @typedef {Object} VocabularySizeTestItem
 * @property {string} id
 * @property {string} word
 * @property {number} band
 * @property {number} rank
 * @property {number} index — 0-based overall progress
 */

/**
 * @param {unknown[]} arr
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 從各頻率帶抽樣，組成 50 詞測驗 deck（Lenguia：每帶 5 詞）
 * @returns {VocabularySizeTestItem[]}
 */
export function buildVocabularySizeDeck() {
  /** @type {VocabularySizeTestItem[]} */
  const deck = [];
  let index = 0;

  for (const bandMeta of FREQUENCY_BANDS) {
    const pool = getWordsForBand(bandMeta.band);
    const picked = shuffleArray(pool).slice(0, WORDS_PER_BAND);
    if (picked.length < WORDS_PER_BAND) {
      throw new Error(`Frequency band ${bandMeta.band} has insufficient words`);
    }
    for (const entry of picked) {
      deck.push({
        id: `vs_b${bandMeta.band}_${entry.word}`,
        word: entry.word,
        band: entry.band,
        rank: entry.rank,
        index,
      });
      index += 1;
    }
  }

  return deck;
}
