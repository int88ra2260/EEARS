/**
 * 頻率帶詞庫（由 canonical + 種子詞自動產生）
 * 更新：npm run build:vocabulary-size-bank
 * @typedef {{ word: string, band: number, rank: number }} FrequencyWordEntry
 */
import { FREQUENCY_WORD_BANK_GENERATED } from './frequencyBankGenerated.js';

/** @type {FrequencyWordEntry[]} */
export const FREQUENCY_WORD_BANK = FREQUENCY_WORD_BANK_GENERATED;

/** @param {number} band */
export function getWordsForBand(band) {
  return FREQUENCY_WORD_BANK.filter((entry) => entry.band === band);
}
