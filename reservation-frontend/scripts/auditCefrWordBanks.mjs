/**
 * CEFR 詞彙稽核：以 canonical vocabulary bank 為權威來源
 *
 * Usage: node scripts/auditCefrWordBanks.mjs [--json]
 */
import { WORD_BRIDGE_THEME_BANKS } from '../src/data/wordBridgeThemes.js';
import {
  CANONICAL_VOCABULARY,
  CANONICAL_BY_WORD,
  getLevelDistribution,
} from '../src/data/learningContent/vocabulary/index.js';
import { RAW_LISTENING_WORDS } from '../src/data/learningContent/listeningLadderWords.js';
import { CEFR_CANONICAL_OVERRIDES } from '../src/data/learningContent/vocabulary/cefrOverrides.js';

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_RANK = Object.fromEntries(CEFR_ORDER.map((l, i) => [l, i]));

/** @type {Set<string>} */
const SUSPICIOUS_A1 = new Set([
  'library', 'campus', 'reservation', 'kitchen', 'bedroom', 'hamster', 'parrot', 'turtle',
]);

function rank(level) {
  return LEVEL_RANK[level] ?? -1;
}

function flattenWordBridgePresentation() {
  /** @type {Map<string, { level: string, themes: string[] }>} */
  const map = new Map();
  for (const level of CEFR_ORDER) {
    const themes = WORD_BRIDGE_THEME_BANKS[level] || [];
    for (const group of themes) {
      for (const word of group.words) {
        const key = word.toLowerCase();
        const prev = map.get(key);
        if (!prev) {
          map.set(key, { level, themes: [group.theme] });
        } else if (prev.level !== level) {
          prev.duplicateLevels = [...(prev.duplicateLevels || [prev.level]), level];
        }
      }
    }
  }
  return map;
}

function findPresentationMismatches(wbPresentation) {
  const rows = [];
  for (const [word, meta] of wbPresentation) {
    const canonical = CANONICAL_BY_WORD[word];
    if (!canonical) {
      rows.push({ word, issue: 'missing_from_canonical', wbLevel: meta.level });
      continue;
    }
    const gap = Math.abs(rank(meta.level) - rank(canonical.level));
    if (gap >= 2) {
      rows.push({
        word,
        issue: 'presentation_gap',
        wbPresentationLevel: meta.level,
        canonicalLevel: canonical.level,
        gap,
      });
    }
  }
  return rows.sort((a, b) => (b.gap || 0) - (a.gap || 0));
}

function findSuspiciousCanonical() {
  const rows = [];
  for (const entry of CANONICAL_VOCABULARY) {
    const r = rank(entry.level);
    if (SUSPICIOUS_A1.has(entry.word) && r <= LEVEL_RANK.A1) {
      rows.push({ word: entry.word, level: entry.level, reason: 'a1_likely_too_advanced' });
    }
  }
  return rows;
}

function findUnresolvedOverrides() {
  const wb = flattenWordBridgePresentation();
  const llWords = new Map(RAW_LISTENING_WORDS.map((r) => [r.word.toLowerCase(), r.level]));
  const conflicts = [];
  for (const word of new Set([...wb.keys(), ...llWords.keys()])) {
    const wbLevel = wb.get(word)?.level;
    const llLevel = llWords.get(word);
    if (!wbLevel || !llLevel || wbLevel === llLevel) continue;
    const gap = Math.abs(rank(wbLevel) - rank(llLevel));
    if (gap >= 1) {
      const canonical = CANONICAL_BY_WORD[word]?.level;
      conflicts.push({
        word,
        wordBridge: wbLevel,
        listeningLadder: llLevel,
        canonical,
        hasOverride: Boolean(CEFR_CANONICAL_OVERRIDES[word]),
        gap,
      });
    }
  }
  return conflicts;
}

function main() {
  const presentationMismatches = findPresentationMismatches(flattenWordBridgePresentation());
  const suspicious = findSuspiciousCanonical();
  const crossSource = findUnresolvedOverrides();
  const missingCanonical = presentationMismatches.filter((r) => r.issue === 'missing_from_canonical');

  const report = {
    generatedAt: new Date().toISOString(),
    bankSize: CANONICAL_VOCABULARY.length,
    levelDistribution: getLevelDistribution(),
    presentationMismatches: presentationMismatches.filter((r) => r.issue !== 'missing_from_canonical'),
    missingFromCanonical: missingCanonical,
    suspiciousGrading: suspicious,
    crossSourceLevels: crossSource,
    summary: {
      presentationGapCount: presentationMismatches.filter((r) => r.issue === 'presentation_gap').length,
      missingCount: missingCanonical.length,
      suspiciousCount: suspicious.length,
      crossSourceCount: crossSource.length,
    },
  };

  const asJson = process.argv.includes('--json');
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.summary.missingCount > 0 ? 1 : 0);
    return;
  }

  console.log('=== EEARS CEFR 詞彙稽核（Canonical Bank）===\n');
  console.log(`詞庫總量: ${report.bankSize}`);
  console.log('各級詞數:', report.levelDistribution);
  console.log(`\nWord Bridge 主題 vs canonical 差距 ≥2: ${report.summary.presentationGapCount} 筆`);
  report.presentationMismatches.slice(0, 15).forEach((row) => {
    console.log(`  - ${row.word}: WB主題=${row.wbPresentationLevel}, canonical=${row.canonicalLevel}`);
  });
  if (report.summary.missingCount) {
    console.log(`\n主題詞未入 canonical: ${report.summary.missingCount} 筆`);
  }
  if (report.summary.suspiciousCount) {
    console.log(`\n可疑 A1 分級: ${report.summary.suspiciousCount} 筆`);
  }
  console.log('\n跨來源 level 對照（含 override 標記）:', report.summary.crossSourceCount, '筆');
  process.exit(report.summary.missingCount > 0 ? 1 : 0);
}

main();
