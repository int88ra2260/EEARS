/**
 * 從 canonical 詞庫批量產生：
 * - Vocabulary Depth 題庫（每級 ≥30 題）
 * - Vocabulary Size 頻率詞庫（每帶 ≥25 詞，總量 ≥250）
 *
 * Usage: node scripts/buildMicroLearningQuestionBanks.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_VOCABULARY } from '../src/data/learningContent/vocabulary/canonicalVocabulary.js';
import {
  inferA2Pos,
  selectA2Template,
  validateA2ContextQuestion,
  wordLeaksIntoPrompt,
} from '../src/data/learningContent/vocabularyDepth/a2ContextRules.js';
import {
  getB1SynonymEntry,
  validateB1SynonymQuestion,
} from '../src/data/learningContent/vocabularyDepth/b1SynonymRules.js';
import {
  getA1Definition,
  validateA1DefinitionQuestion,
} from '../src/data/learningContent/vocabularyDepth/a1DefinitionRules.js';
import {
  getB2Collocation,
  validateB2CollocationQuestion,
} from '../src/data/learningContent/vocabularyDepth/b2CollocationRules.js';
import {
  getC1Nuance,
  validateC1NuanceQuestion,
} from '../src/data/learningContent/vocabularyDepth/c1NuanceRules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEPTH_OUT = path.join(ROOT, 'src/data/learningContent/vocabularyDepth/questionBankGenerated.js');
const SIZE_OUT = path.join(ROOT, 'src/data/learningContent/vocabularySize/frequencyBankGenerated.js');

const DEPTH_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const MIN_QUESTIONS_PER_LEVEL = 30;
const WORDS_PER_FREQUENCY_BAND = 25;

const CEFR_TO_BANDS = {
  A1: [1],
  A2: [2],
  B1: [3],
  B2: [4, 5],
  C1: [6, 7],
  C2: [8, 9, 10],
};



function extractUsedDepthWords() {
  const used = new Set();
  for (const file of ['questionBank.js', 'questionBankExtended.js']) {
    const content = fs.readFileSync(path.join(ROOT, 'src/data/learningContent/vocabularyDepth', file), 'utf8');
    const re = /word: '([^']+)'/g;
    let m = re.exec(content);
    while (m) {
      used.add(m[1].toLowerCase());
      m = re.exec(content);
    }
  }
  return used;
}

function parseManualFrequencyBank() {
  const content = fs.readFileSync(
    path.join(ROOT, 'src/data/learningContent/vocabularySize/frequencyBank.js'),
    'utf8',
  );
  /** @type {{ word: string, band: number, rank: number }[]} */
  const entries = [];
  const re = /\{\s*word:\s*'([^']+)',\s*band:\s*(\d+),\s*rank:\s*(\d+)\s*\}/g;
  let m = re.exec(content);
  while (m) {
    entries.push({ word: m[1], band: Number(m[2]), rank: Number(m[3]) });
    m = re.exec(content);
  }
  return entries;
}

function extractExistingFrequencyWords() {
  return new Set(parseManualFrequencyBank().map((e) => e.word.toLowerCase()));
}

function pickDistractors(pool, word, count = 3, posFilter, promptText = '') {
  const candidates = pool.filter((e) => {
    if (e.word.toLowerCase() === word.toLowerCase()) return false;
    if (posFilter && inferA2Pos(e) !== posFilter) return false;
    if (promptText && wordLeaksIntoPrompt(e.word, promptText)) return false;
    return true;
  });
  const picked = [];
  const used = new Set();
  let i = 0;
  while (picked.length < count && i < candidates.length * 2) {
    const entry = candidates[i % Math.max(candidates.length, 1)];
    i += 1;
    if (!entry) break;
    const key = entry.word.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    picked.push(entry);
  }
  while (picked.length < count) {
    const fallback = pool.find(
      (e) => e.word.toLowerCase() !== word.toLowerCase()
        && !used.has(e.word.toLowerCase()),
    );
    if (!fallback) break;
    used.add(fallback.word.toLowerCase());
    picked.push(fallback);
  }
  return picked;
}

function posLabel(entry) {
  const pos = entry.listening?.pos || entry.pos;
  if (pos === 'noun') return 'noun';
  if (pos === 'verb') return 'verb';
  if (pos === 'adjective') return 'adjective';
  if (pos === 'adverb') return 'adverb';
  return 'word';
}

function topicTag(entry) {
  const topic = entry.listening?.topic || entry.topics?.[0] || entry.wbThemes?.[0];
  return topic || 'campus_life';
}


function buildA1Question(entry, pool, seq) {
  const def = getA1Definition(entry);
  const question = {
    id: `vd_gen_a1_${String(seq).padStart(2, '0')}`,
    level: 'A1',
    type: 'definition',
    word: entry.word,
    prompt: `What does "${entry.word}" mean?`,
    promptZh: `「${entry.word}」是什麼意思？`,
    options: [
      { id: 'a', text: def.correct.text, textZh: def.correct.textZh },
      ...def.distractors.map((d, idx) => ({
        id: ['b', 'c', 'd'][idx],
        text: d.text,
        textZh: d.textZh,
      })),
    ],
    correctOptionId: 'a',
    explanationEn: `"${entry.word}" is a basic English ${posLabel(entry)}.`,
    explanationZh: `「${entry.word}」的基本中文意思為「${entry.zh}」。`,
    tags: [topicTag(entry)],
  };
  validateA1DefinitionQuestion(question);
  return question;
}

function buildA2Question(entry, pool, seq) {
  const tpl = selectA2Template(entry, seq);
  const pos = inferA2Pos(entry);
  const distractors = pickDistractors(pool, entry.word, 3, pos, `${tpl.prompt} ${tpl.promptZh || ''}`);
  const question = {
    id: `vd_gen_a2_${String(seq).padStart(2, '0')}`,
    level: 'A2',
    type: 'context',
    word: entry.word,
    prompt: tpl.prompt,
    promptZh: tpl.promptZh,
    options: [
      { id: 'a', text: entry.word, textZh: `${entry.word}（${entry.zh}）` },
      ...distractors.map((d, idx) => ({
        id: ['b', 'c', 'd'][idx],
        text: d.word,
        textZh: `${d.word}（${d.zh}）`,
      })),
    ],
    correctOptionId: 'a',
    tags: [topicTag(entry)],
  };
  validateA2ContextQuestion(question);
  return question;
}

function buildB1Question(entry, pool, seq) {
  const syn = getB1SynonymEntry(entry);
  const question = {
    id: `vd_gen_b1_${String(seq).padStart(2, '0')}`,
    level: 'B1',
    type: 'synonym',
    word: entry.word,
    prompt: `Which is closest in meaning to "${entry.word}"?`,
    promptZh: `哪個詞與 "${entry.word}" 意思最接近？`,
    options: [
      { id: 'a', text: syn.correct.text, textZh: syn.correct.textZh },
      ...syn.distractors.map((d, idx) => ({
        id: ['b', 'c', 'd'][idx],
        text: d.text,
        textZh: d.textZh,
      })),
    ],
    correctOptionId: 'a',
    tags: [topicTag(entry)],
  };
  validateB1SynonymQuestion(question);
  return question;
}

function buildB2Question(entry, pool, seq) {
  const col = getB2Collocation(entry);
  const question = {
    id: `vd_gen_b2_${String(seq).padStart(2, '0')}`,
    level: 'B2',
    type: 'collocation',
    word: entry.word,
    prompt: 'Which collocation is most natural?',
    promptZh: '哪個搭配最自然？',
    options: [
      { id: 'a', text: col.correct.text, textZh: col.correct.textZh },
      ...col.distractors.map((d, idx) => ({
        id: ['b', 'c', 'd'][idx],
        text: d.text,
        textZh: d.textZh,
      })),
    ],
    correctOptionId: 'a',
    tags: [topicTag(entry)],
  };
  validateB2CollocationQuestion(question);
  return question;
}

function buildC1Question(entry, pool, seq) {
  const nuance = getC1Nuance(entry);
  const question = {
    id: `vd_gen_c1_${String(seq).padStart(2, '0')}`,
    level: 'C1',
    type: 'nuance',
    word: entry.word,
    prompt: nuance.prompt,
    promptZh: nuance.promptZh,
    options: [
      { id: 'a', text: nuance.correct.text, textZh: nuance.correct.textZh },
      ...nuance.distractors.map((d, idx) => ({
        id: ['b', 'c', 'd'][idx],
        text: d.text,
        textZh: d.textZh,
      })),
    ],
    correctOptionId: 'a',
    tags: [topicTag(entry)],
  };
  validateC1NuanceQuestion(question);
  return question;
}

const BUILDERS = {
  A1: buildA1Question,
  A2: buildA2Question,
  B1: buildB1Question,
  B2: buildB2Question,
  C1: buildC1Question,
};

function countManualQuestions(level) {
  let count = 0;
  for (const file of ['questionBank.js', 'questionBankExtended.js']) {
    const content = fs.readFileSync(path.join(ROOT, 'src/data/learningContent/vocabularyDepth', file), 'utf8');
    const re = new RegExp(`level: '${level}'`, 'g');
    count += (content.match(re) || []).length;
  }
  return count;
}

function buildDepthQuestions() {
  const usedWords = extractUsedDepthWords();
  /** @type {object[]} */
  const questions = [];

  for (const level of DEPTH_LEVELS) {
    const pool = CANONICAL_VOCABULARY.filter(
      (e) => e.level === level && !usedWords.has(e.word.toLowerCase()),
    );
    const manualCount = countManualQuestions(level);
    const need = Math.max(0, MIN_QUESTIONS_PER_LEVEL - manualCount);
    const selected = pool.slice(0, need);
    selected.forEach((entry, idx) => {
      questions.push(BUILDERS[level](entry, pool, idx + 1));
      usedWords.add(entry.word.toLowerCase());
    });

    const total = manualCount + selected.length;
    if (total < MIN_QUESTIONS_PER_LEVEL) {
      throw new Error(
        `Vocabulary Depth ${level}: only ${total} questions (need ${MIN_QUESTIONS_PER_LEVEL}); add more canonical words or lower threshold`,
      );
    }
  }

  return questions;
}

function rankForBand(band, index, total) {
  const bandSize = 1000;
  const rankMin = (band - 1) * bandSize + 1;
  const rankMax = band * bandSize;
  if (total <= 1) return rankMin + Math.floor(bandSize / 2);
  const step = (rankMax - rankMin) / (total - 1);
  return Math.round(rankMin + step * index);
}

function buildFrequencyBank() {
  const manualEntries = parseManualFrequencyBank();
  const existing = new Set(manualEntries.map((e) => e.word.toLowerCase()));
  /** @type {{ word: string, band: number, rank: number }[]} */
  const entries = [];

  for (let band = 1; band <= 10; band += 1) {
    const manualInBand = manualEntries.filter((e) => e.band === band);
    const need = Math.max(0, WORDS_PER_FREQUENCY_BAND - manualInBand.length);
    if (need === 0) continue;

    const cefrLevel = Object.entries(CEFR_TO_BANDS).find(([, bands]) => bands.includes(band))?.[0];
    if (!cefrLevel) throw new Error(`No CEFR mapping for band ${band}`);

    const bandsForLevel = CEFR_TO_BANDS[cefrLevel];
    const bandIndex = bandsForLevel.indexOf(band);
    const levelPool = CANONICAL_VOCABULARY.filter((e) => e.level === cefrLevel);
    const chunkSize = Math.ceil(levelPool.length / bandsForLevel.length);
    const sliceStart = bandIndex * chunkSize;
    const slice = levelPool.slice(sliceStart, sliceStart + chunkSize);

    /** @type {typeof CANONICAL_VOCABULARY} */
    const picked = [];
    const tryPick = (pool) => {
      for (const entry of pool) {
        if (picked.length >= need) break;
        const key = entry.word.toLowerCase();
        if (existing.has(key)) continue;
        picked.push(entry);
        existing.add(key);
      }
    };

    tryPick(slice);
    if (picked.length < need) {
      tryPick(levelPool);
    }
    if (picked.length < need) {
      throw new Error(
        `Frequency band ${band}: need ${need} new words, only found ${picked.length} (CEFR ${cefrLevel})`,
      );
    }

    picked.forEach((entry, idx) => {
      entries.push({
        word: entry.word,
        band,
        rank: rankForBand(band, manualInBand.length + idx, WORDS_PER_FREQUENCY_BAND),
      });
    });
  }

  return entries;
}

function serializeQuestion(q) {
  const opts = q.options
    .map(
      (o) =>
        `      { id: '${o.id}', text: ${JSON.stringify(o.text)}, textZh: ${JSON.stringify(o.textZh)} }`,
    )
    .join(',\n');
  const tags = q.tags ? `tags: ${JSON.stringify(q.tags)},` : '';
  const explEn = q.explanationEn ? `explanationEn: ${JSON.stringify(q.explanationEn)},` : '';
  const explZh = q.explanationZh ? `explanationZh: ${JSON.stringify(q.explanationZh)},` : '';
  return `  {
    id: '${q.id}', level: '${q.level}', type: '${q.type}', word: '${q.word}',
    prompt: ${JSON.stringify(q.prompt)},
    promptZh: ${JSON.stringify(q.promptZh)},
    options: [
${opts},
    ],
    correctOptionId: '${q.correctOptionId}',
    ${explEn}
    ${explZh}
    ${tags}
  }`;
}

function writeDepthFile(questions) {
  const body = questions.map(serializeQuestion).join(',\n');
  const content = `/**
 * AUTO-GENERATED — Vocabulary Depth 擴充題庫
 * Run: npm run build:micro-learning-banks
 * Do not edit manually.
 */
/** @typedef {import('./questionBank').VocabularyDepthQuestion} VocabularyDepthQuestion */

/** @type {VocabularyDepthQuestion[]} */
export const VOCABULARY_DEPTH_QUESTIONS_GENERATED = [
${body}
];
`;
  fs.writeFileSync(DEPTH_OUT, content, 'utf8');
}

function writeSizeFile(entries) {
  const lines = entries.map(
    (e) => `  { word: '${e.word.replace(/'/g, "\\'")}', band: ${e.band}, rank: ${e.rank} },`,
  );
  const content = `/**
 * AUTO-GENERATED — Vocabulary Size 頻率詞庫擴充
 * Run: npm run build:micro-learning-banks
 * Do not edit manually.
 */
/** @type {import('./frequencyBank').FrequencyWordEntry[]} */
export const FREQUENCY_WORD_BANK_GENERATED = [
${lines.join('\n')}
];
`;
  fs.writeFileSync(SIZE_OUT, content, 'utf8');
}

async function validateOutputs() {
  const depthContent = fs.readFileSync(DEPTH_OUT, 'utf8');
  const sizeContent = fs.readFileSync(SIZE_OUT, 'utf8');
  const depthCount = (depthContent.match(/id: 'vd_gen_/g) || []).length;
  const sizeCount = (sizeContent.match(/word: '/g) || []).length;

  for (const level of DEPTH_LEVELS) {
    const manual = countManualQuestions(level);
    const levelGenerated = (depthContent.match(new RegExp(`level: '${level}'`, 'g')) || []).length;
    const total = manual + levelGenerated;
    if (total < MIN_QUESTIONS_PER_LEVEL) {
      throw new Error(`Post-merge depth ${level}: ${total} questions (manual ${manual}, generated ${levelGenerated})`);
    }
  }

  const manualSize = parseManualFrequencyBank().length;
  if (manualSize + sizeCount < 250) {
    throw new Error(`Post-merge size bank: ${manualSize + sizeCount} words`);
  }

  console.log('Validation OK');
  console.log('Generated depth questions:', depthCount);
  console.log('Generated frequency words:', sizeCount);
  console.log('Total frequency words (approx):', manualSize + sizeCount);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const depthQuestions = buildDepthQuestions();
  const frequencyEntries = buildFrequencyBank();

  if (!checkOnly) {
    writeDepthFile(depthQuestions);
    writeSizeFile(frequencyEntries);
    console.log(`Wrote ${depthQuestions.length} depth questions → ${path.relative(ROOT, DEPTH_OUT)}`);
    console.log(`Wrote ${frequencyEntries.length} frequency words → ${path.relative(ROOT, SIZE_OUT)}`);
  }

  return validateOutputs();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
