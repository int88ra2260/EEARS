/**
 * 從 canonical 單字庫擴充 Vocabulary Size 頻率帶詞庫（目標 ≥250 詞）
 *
 * Usage: node scripts/buildVocabularySizeFrequencyBank.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_VOCABULARY } from '../src/data/learningContent/vocabulary/canonicalVocabulary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../src/data/learningContent/vocabularySize/frequencyBankGenerated.js');
const SEED_PATH = path.join(__dirname, '../src/data/learningContent/vocabularySize/frequencyBankSeeds.js');

const BAND_COUNT = 10;
const WORDS_PER_BAND_TARGET = 25;
const MIN_TOTAL = 250;

/** CEFR → 主要頻率帶 */
const LEVEL_TO_BANDS = {
  A1: [1, 2],
  A2: [2, 3],
  B1: [3, 4, 5],
  B2: [4, 5, 6],
  C1: [6, 7, 8],
  C2: [8, 9, 10],
};

function hashWord(word) {
  let h = 0;
  for (let i = 0; i < word.length; i += 1) {
    h = (h * 31 + word.charCodeAt(i)) >>> 0;
  }
  return h;
}

function rankForBand(band, index, totalInBand) {
  const bandMeta = {
    1: [1, 1000],
    2: [1001, 2000],
    3: [2001, 3000],
    4: [3001, 4000],
    5: [4001, 5000],
    6: [5001, 6000],
    7: [6001, 7000],
    8: [7001, 8000],
    9: [8001, 9000],
    10: [9001, 10000],
  }[band];
  const [min, max] = bandMeta;
  if (totalInBand <= 1) return min + Math.floor((max - min) / 2);
  const step = (max - min) / (totalInBand + 1);
  return Math.round(min + step * (index + 1));
}

function assignBand(entry) {
  const bands = LEVEL_TO_BANDS[entry.level] || [5];
  const pick = bands[hashWord(entry.word) % bands.length];
  return pick;
}

async function loadSeedBank() {
  const mod = await import('../src/data/learningContent/vocabularySize/frequencyBankSeeds.js');
  return mod.FREQUENCY_WORD_BANK_SEEDS;
}

async function buildBank() {
  const SEED_BANK = await loadSeedBank();
  const byWord = new Map();

  for (const seed of SEED_BANK) {
    byWord.set(seed.word.toLowerCase(), { ...seed });
  }

  const sorted = [...CANONICAL_VOCABULARY].sort((a, b) => a.word.localeCompare(b.word));
  for (const entry of sorted) {
    const key = entry.word.toLowerCase();
    if (byWord.has(key)) continue;
    const band = assignBand(entry);
    byWord.set(key, { word: entry.word, band, rank: 0 });
  }

  /** @type {Record<number, { word: string, band: number, rank: number }[]>} */
  const byBand = {};
  for (let b = 1; b <= BAND_COUNT; b += 1) byBand[b] = [];

  for (const item of byWord.values()) {
    byBand[item.band].push(item);
  }

  // 若某帶不足，從相鄰 CEFR 詞彙補入
  for (let band = 1; band <= BAND_COUNT; band += 1) {
    if (byBand[band].length >= WORDS_PER_BAND_TARGET) continue;
    const need = WORDS_PER_BAND_TARGET - byBand[band].length;
    const donors = sorted.filter((e) => !byWord.has(e.word.toLowerCase()) || byWord.get(e.word.toLowerCase()).band !== band);
    for (const entry of donors) {
      if (byBand[band].length >= WORDS_PER_BAND_TARGET) break;
      const key = entry.word.toLowerCase();
      if (byWord.has(key) && byWord.get(key).band === band) continue;
      if (byWord.has(key)) {
        // duplicate word already assigned — skip
        continue;
      }
      byWord.set(key, { word: entry.word, band, rank: 0 });
      byBand[band].push(byWord.get(key));
    }
    if (byBand[band].length < WORDS_PER_BAND_TARGET) {
      // Reassign overflow from heavy bands
      for (let donorBand = 1; donorBand <= BAND_COUNT && byBand[band].length < WORDS_PER_BAND_TARGET; donorBand += 1) {
        if (donorBand === band || byBand[donorBand].length <= WORDS_PER_BAND_TARGET) continue;
        while (byBand[band].length < WORDS_PER_BAND_TARGET && byBand[donorBand].length > WORDS_PER_BAND_TARGET) {
          const moved = byBand[donorBand].pop();
          if (!moved) break;
          moved.band = band;
          byBand[band].push(moved);
          byWord.set(moved.word.toLowerCase(), moved);
        }
      }
    }
  }

  /** @type {{ word: string, band: number, rank: number }[]} */
  const result = [];
  for (let band = 1; band <= BAND_COUNT; band += 1) {
    const list = byBand[band].sort((a, b) => a.word.localeCompare(b.word));
    list.forEach((item, index) => {
      item.rank = rankForBand(band, index, list.length);
      result.push({ word: item.word, band: item.band, rank: item.rank });
    });
  }

  return result.sort((a, b) => a.band - b.band || a.rank - b.rank || a.word.localeCompare(b.word));
}

function validate(bank) {
  if (bank.length < MIN_TOTAL) {
    throw new Error(`Frequency bank has ${bank.length} words; need ≥${MIN_TOTAL}`);
  }
  for (let band = 1; band <= BAND_COUNT; band += 1) {
    const n = bank.filter((e) => e.band === band).length;
    if (n < WORDS_PER_BAND_TARGET) {
      throw new Error(`Band ${band} has ${n} words; need ≥${WORDS_PER_BAND_TARGET}`);
    }
  }
}

function renderModule(bank) {
  const bandCounts = Array.from({ length: BAND_COUNT }, (_, i) => {
    const band = i + 1;
    return `  band ${band}: ${bank.filter((e) => e.band === band).length}`;
  }).join('\n');

  return `/**
 * Vocabulary Size — AUTO-GENERATED frequency band pool
 * Run: npm run build:vocabulary-size-bank
 * Total: ${bank.length} words
${bandCounts}
 * Do not edit manually.
 */

/** @type {import('./frequencyBank').FrequencyWordEntry[]} */
export const FREQUENCY_WORD_BANK_GENERATED = ${JSON.stringify(bank, null, 2)};
`;
}

const isCheck = process.argv.includes('--check');
const bank = await buildBank();
validate(bank);

if (isCheck) {
  console.log(`Vocabulary Size frequency bank OK: ${bank.length} words`);
  for (let band = 1; band <= BAND_COUNT; band += 1) {
    console.log(`  band ${band}: ${bank.filter((e) => e.band === band).length}`);
  }
  process.exit(0);
}

fs.writeFileSync(OUT_PATH, renderModule(bank), 'utf8');
console.log(`Wrote ${bank.length} words → ${path.relative(process.cwd(), OUT_PATH)}`);
