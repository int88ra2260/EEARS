/**
 * 合併 Word Bridge、Listening Ladder、Glossary → canonical 單字庫
 *
 * Usage: node scripts/buildCanonicalVocabularyBank.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORD_BRIDGE_THEME_BANKS } from '../src/data/wordBridgeThemes.js';
import { RAW_LISTENING_WORDS } from '../src/data/learningContent/listeningLadderWords.js';
import {
  CEFR_CANONICAL_OVERRIDES,
} from '../src/data/learningContent/vocabulary/cefrOverrides.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../src/data/learningContent/vocabulary/canonicalVocabulary.js');
const EXISTING_BANK_PATH = OUT_PATH;

function loadExistingZhMap() {
  try {
    if (!fs.existsSync(EXISTING_BANK_PATH)) return {};
    const content = fs.readFileSync(EXISTING_BANK_PATH, 'utf8');
    /** @type {Record<string, string>} */
    const map = {};
    const re = /word: '([^']+)'[^]*?zh: '([^']*)'/g;
    let m = re.exec(content);
    while (m) {
      map[m[1]] = m[2];
      m = re.exec(content);
    }
    return map;
  } catch {
    return {};
  }
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_RANK = Object.fromEntries(CEFR_ORDER.map((l, i) => [l, i]));

function rank(level) {
  return LEVEL_RANK[level] ?? -1;
}

function pickLevel(word, wbLevel, llLevel) {
  const override = CEFR_CANONICAL_OVERRIDES[word];
  if (override) return override.level;

  if (wbLevel && llLevel) {
    if (wbLevel === llLevel) return wbLevel;
    const gap = Math.abs(rank(wbLevel) - rank(llLevel));
    if (gap <= 1) return CEFR_ORDER[Math.min(rank(wbLevel), rank(llLevel))];
    return CEFR_ORDER[Math.min(rank(wbLevel), rank(llLevel))];
  }
  return wbLevel || llLevel || 'B1';
}

function slugId(word) {
  return `v_${word.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function collectWordBridge() {
  /** @type {Map<string, { wbLevels: Set<string>, themes: string[] }>} */
  const map = new Map();
  for (const level of CEFR_ORDER) {
    const themes = WORD_BRIDGE_THEME_BANKS[level] || [];
    for (const group of themes) {
      for (const word of group.words) {
        const key = word.toLowerCase();
        const prev = map.get(key) || { wbLevels: new Set(), themes: [] };
        prev.wbLevels.add(level);
        if (!prev.themes.includes(group.theme)) prev.themes.push(group.theme);
        map.set(key, prev);
      }
    }
  }
  return map;
}

function collectListening() {
  /** @type {Map<string, typeof RAW_LISTENING_WORDS[0] & { llLevels: Set<string> }>} */
  const map = new Map();
  for (const raw of RAW_LISTENING_WORDS) {
    const key = raw.word.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...raw, llLevels: new Set([raw.level]) });
    } else {
      prev.llLevels.add(raw.level);
    }
  }
  return map;
}

function buildBank() {
  const existingZh = loadExistingZhMap();
  const wb = collectWordBridge();
  const ll = collectListening();
  const allWords = new Set([...wb.keys(), ...ll.keys()]);
  /** @type {Array<object>} */
  const entries = [];
  const conflicts = [];

  for (const word of [...allWords].sort()) {
    const wbMeta = wb.get(word);
    const llMeta = ll.get(word);
    const wbLevel = wbMeta ? [...wbMeta.wbLevels].sort((a, b) => rank(a) - rank(b))[0] : null;
    const llLevel = llMeta ? [...llMeta.llLevels].sort((a, b) => rank(a) - rank(b))[0] : null;

    if (wbLevel && llLevel && wbLevel !== llLevel) {
      const gap = Math.abs(rank(wbLevel) - rank(llLevel));
      const canonical = pickLevel(word, wbLevel, llLevel);
      if (gap >= 1 && !CEFR_CANONICAL_OVERRIDES[word]) {
        conflicts.push({ word, wbLevel, llLevel, gap, canonical });
      }
    }

    const level = pickLevel(word, wbLevel, llLevel);
    const zh = existingZh[word] || llMeta?.zh || null;
    if (!zh) {
      throw new Error(`Missing zh gloss for "${word}"`);
    }

    /** @type {string[]} */
    const sources = [];
    if (wbMeta) sources.push('word_bridge');
    if (llMeta) sources.push('listening_ladder');

    const entry = {
      id: slugId(word),
      word,
      level,
      zh,
      sources,
    };

    if (llMeta?.pos) entry.pos = llMeta.pos;
    if (llMeta?.topic) entry.topics = [llMeta.topic];
    if (wbMeta?.themes?.length) {
      entry.wbThemes = wbMeta.themes;
      if (wbLevel && wbLevel !== level) {
        entry.wbPresentationLevel = wbLevel;
      }
    }
    if (llMeta) {
      entry.listening = {
        topic: llMeta.topic,
        pos: llMeta.pos,
        distractors: llMeta.d || [],
      };
    }
    const override = CEFR_CANONICAL_OVERRIDES[word];
    if (override?.note) entry.cefrNote = override.note;

    entries.push(entry);
  }

  return { entries, conflicts, stats: { total: entries.length, wbOnly: entries.filter((e) => e.sources.length === 1 && e.sources[0] === 'word_bridge').length, llOnly: entries.filter((e) => e.sources.length === 1 && e.sources[0] === 'listening_ladder').length, shared: entries.filter((e) => e.sources.length > 1).length } };
}

function serializeEntry(e) {
  const parts = [
    `id: '${e.id}'`,
    `word: '${e.word.replace(/'/g, "\\'")}'`,
    `level: '${e.level}'`,
    `zh: '${e.zh.replace(/'/g, "\\'")}'`,
    `sources: ${JSON.stringify(e.sources)}`,
  ];
  if (e.pos) parts.push(`pos: '${e.pos}'`);
  if (e.topics) parts.push(`topics: ${JSON.stringify(e.topics)}`);
  if (e.wbThemes) parts.push(`wbThemes: ${JSON.stringify(e.wbThemes)}`);
  if (e.wbPresentationLevel) parts.push(`wbPresentationLevel: '${e.wbPresentationLevel}'`);
  if (e.cefrNote) parts.push(`cefrNote: ${JSON.stringify(e.cefrNote)}`);
  if (e.listening) {
    parts.push(`listening: { topic: '${e.listening.topic}', pos: '${e.listening.pos}', distractors: ${JSON.stringify(e.listening.distractors)} }`);
  }
  return `  { ${parts.join(', ')} }`;
}

function writeBank(entries) {
  const body = entries.map(serializeEntry).join(',\n');
  const content = `/**
 * EEARS Canonical Vocabulary Bank — AUTO-GENERATED
 * Run: npm run build:vocabulary-bank
 * Do not edit manually; update sources + cefrOverrides.js then rebuild.
 */
/** @typedef {import('./types').CanonicalVocabEntry} CanonicalVocabEntry */

/** @type {CanonicalVocabEntry[]} */
export const CANONICAL_VOCABULARY = [
${body}
];

/** @type {Record<string, CanonicalVocabEntry>} */
export const CANONICAL_BY_WORD = Object.fromEntries(
  CANONICAL_VOCABULARY.map((entry) => [entry.word, entry]),
);

/** @type {Record<string, string>} */
export const CANONICAL_ZH_BY_WORD = Object.fromEntries(
  CANONICAL_VOCABULARY.map((entry) => [entry.word, entry.zh]),
);

/** @deprecated 相容舊 import；請改用 CANONICAL_ZH_BY_WORD */
export const WORD_ZH = CANONICAL_ZH_BY_WORD;
`;
  fs.writeFileSync(OUT_PATH, content, 'utf8');
}

function main() {
  const { entries, conflicts, stats } = buildBank();
  const checkOnly = process.argv.includes('--check');

  const unresolved = conflicts.filter((c) => !CEFR_CANONICAL_OVERRIDES[c.word]);
  if (unresolved.length > 0) {
    console.error('Unresolved CEFR conflicts (add to cefrOverrides.js):');
    unresolved.forEach((c) => {
      console.error(`  ${c.word}: WB=${c.wbLevel}, LL=${c.llLevel} (gap ${c.gap})`);
    });
    process.exit(1);
  }

  if (checkOnly) {
    console.log(JSON.stringify({ stats, conflictCount: conflicts.length }, null, 2));
    process.exit(0);
    return;
  }

  writeBank(entries);
  console.log(`Wrote ${entries.length} entries → ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log('Stats:', stats);
}

main();
