/**
 * 頻率帶詞庫（近似 10K 詞頻分層；每帶 ≥25 詞供隨機抽樣）
 * @typedef {{ word: string, band: number, rank: number }} FrequencyWordEntry
 */

import { FREQUENCY_WORD_BANK_GENERATED } from './frequencyBankGenerated';

/** @type {FrequencyWordEntry[]} */
const FREQUENCY_WORD_BANK_MANUAL = [
  // Band 1 — ranks 1–1000
  { word: 'hello', band: 1, rank: 120 },
  { word: 'book', band: 1, rank: 280 },
  { word: 'water', band: 1, rank: 350 },
  { word: 'friend', band: 1, rank: 410 },
  { word: 'school', band: 1, rank: 520 },
  { word: 'time', band: 1, rank: 90 },
  { word: 'food', band: 1, rank: 440 },
  { word: 'happy', band: 1, rank: 680 },
  { word: 'teacher', band: 1, rank: 750 },
  { word: 'student', band: 1, rank: 820 },
  // Band 2 — 1001–2000
  { word: 'reservation', band: 2, rank: 1100 },
  { word: 'schedule', band: 2, rank: 1250 },
  { word: 'culture', band: 2, rank: 1380 },
  { word: 'career', band: 2, rank: 1520 },
  { word: 'passport', band: 2, rank: 1680 },
  { word: 'activity', band: 2, rank: 1420 },
  { word: 'meeting', band: 2, rank: 1590 },
  { word: 'introduce', band: 2, rank: 1750 },
  { word: 'register', band: 2, rank: 1880 },
  { word: 'colleague', band: 2, rank: 1950 },
  // Band 3 — 2001–3000
  { word: 'participate', band: 3, rank: 2100 },
  { word: 'presentation', band: 3, rank: 2280 },
  { word: 'deadline', band: 3, rank: 2450 },
  { word: 'academic', band: 3, rank: 2620 },
  { word: 'recommend', band: 3, rank: 2780 },
  { word: 'experience', band: 3, rank: 2350 },
  { word: 'challenge', band: 3, rank: 2510 },
  { word: 'approach', band: 3, rank: 2690 },
  { word: 'confident', band: 3, rank: 2850 },
  { word: 'volunteer', band: 3, rank: 2920 },
  // Band 4 — 3001–4000
  { word: 'framework', band: 4, rank: 3150 },
  { word: 'capability', band: 4, rank: 3320 },
  { word: 'influence', band: 4, rank: 3480 },
  { word: 'demonstrate', band: 4, rank: 3650 },
  { word: 'prioritize', band: 4, rank: 3820 },
  { word: 'acknowledge', band: 4, rank: 3210 },
  { word: 'hesitate', band: 4, rank: 3390 },
  { word: 'clarify', band: 4, rank: 3560 },
  { word: 'summarize', band: 4, rank: 3710 },
  { word: 'argument', band: 4, rank: 3960 },
  // Band 5 — 4001–5000
  { word: 'articulate', band: 5, rank: 4150 },
  { word: 'negotiate', band: 5, rank: 4320 },
  { word: 'collaborate', band: 5, rank: 4480 },
  { word: 'hypothesis', band: 5, rank: 4650 },
  { word: 'facilitate', band: 5, rank: 4820 },
  { word: 'consensus', band: 5, rank: 4210 },
  { word: 'implication', band: 5, rank: 4390 },
  { word: 'skeptical', band: 5, rank: 4560 },
  { word: 'proficiency', band: 5, rank: 4710 },
  { word: 'nuanced', band: 5, rank: 4950 },
  // Band 6 — 5001–6000
  { word: 'scrutinize', band: 6, rank: 5180 },
  { word: 'pervasive', band: 6, rank: 5350 },
  { word: 'mitigate', band: 6, rank: 5520 },
  { word: 'discern', band: 6, rank: 5680 },
  { word: 'extrapolate', band: 6, rank: 5850 },
  { word: 'underpin', band: 6, rank: 5240 },
  { word: 'contentious', band: 6, rank: 5410 },
  { word: 'substantial', band: 6, rank: 5590 },
  { word: 'intricate', band: 6, rank: 5760 },
  { word: 'culminate', band: 6, rank: 5920 },
  // Band 7 — 6001–7000
  { word: 'dichotomy', band: 7, rank: 6150 },
  { word: 'paradigm', band: 7, rank: 6320 },
  { word: 'ubiquitous', band: 7, rank: 6480 },
  { word: 'meticulous', band: 7, rank: 6650 },
  { word: 'conjecture', band: 7, rank: 6820 },
  { word: 'disseminate', band: 7, rank: 6210 },
  { word: 'corroborate', band: 7, rank: 6390 },
  { word: 'juxtaposition', band: 7, rank: 6560 },
  { word: 'substantive', band: 7, rank: 6710 },
  { word: 'multifaceted', band: 7, rank: 6980 },
  // Band 8 — 7001–8000
  { word: 'scrutiny', band: 8, rank: 7150 },
  { word: 'heuristic', band: 8, rank: 7320 },
  { word: 'ramifications', band: 8, rank: 7480 },
  { word: 'deliberation', band: 8, rank: 7650 },
  { word: 'incongruous', band: 8, rank: 7820 },
  { word: 'permeate', band: 8, rank: 7210 },
  { word: 'reconcile', band: 8, rank: 7390 },
  { word: 'stipulate', band: 8, rank: 7560 },
  { word: 'elucidate', band: 8, rank: 7710 },
  { word: 'ostensible', band: 8, rank: 7950 },
  // Band 9 — 8001–9000
  { word: 'precipitate', band: 9, rank: 8180 },
  { word: 'quintessential', band: 9, rank: 8350 },
  { word: 'incisive', band: 9, rank: 8520 },
  { word: 'pragmatism', band: 9, rank: 8680 },
  { word: 'instrumental', band: 9, rank: 8850 },
  { word: 'contingency', band: 9, rank: 8240 },
  { word: 'interlocutor', band: 9, rank: 8410 },
  { word: 'epistemic', band: 9, rank: 8590 },
  { word: 'extrapolation', band: 9, rank: 8760 },
  { word: 'corroboration', band: 9, rank: 8920 },
  // Band 10 — 9001–10000
  { word: 'sociolinguistics', band: 10, rank: 9150 },
  { word: 'diglossia', band: 10, rank: 9320 },
  { word: 'sociolect', band: 10, rank: 9480 },
  { word: 'acculturation', band: 10, rank: 9650 },
  { word: 'archaism', band: 10, rank: 9820 },
  { word: 'adiabatic', band: 10, rank: 9210 },
  { word: 'anaphora', band: 10, rank: 9390 },
  { word: 'epistemology', band: 10, rank: 9560 },
  { word: 'rhetoric', band: 10, rank: 9710 },
  { word: 'pidgin', band: 10, rank: 9910 },
];

export const FREQUENCY_WORD_BANK = [
  ...FREQUENCY_WORD_BANK_MANUAL,
  ...FREQUENCY_WORD_BANK_GENERATED,
];

/** @param {number} band */
export function getWordsForBand(band) {
  return FREQUENCY_WORD_BANK.filter((entry) => entry.band === band);
}

export function validateFrequencyBank() {
  for (let band = 1; band <= 10; band += 1) {
    const count = getWordsForBand(band).length;
    if (count < 25) {
      throw new Error(`Vocabulary Size: band ${band} has only ${count} words (need ≥25)`);
    }
  }
  if (FREQUENCY_WORD_BANK.length < 250) {
    throw new Error(`Vocabulary Size: bank has only ${FREQUENCY_WORD_BANK.length} words (need ≥250)`);
  }
}
