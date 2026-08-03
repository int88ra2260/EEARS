'use strict';

/**
 * Learning Journey V3 正式 CEFR 對照引擎（不依賴 legacy englishTestTracking）。
 * @module cefrScoreMapping
 */

const { getCefrRank } = require('./cefr');

const VERSION = '2026-v1';
const VERIFIED_AT = '2026-05-11';

/** 與既有 import 常數相容 */
const MAPPING_VERSION = VERSION;

const TOEFL_IBT_CUTOFF_DATE = '2026-01-21';

const SKILLS = ['listening', 'reading', 'speaking', 'writing'];

/**
 * @typedef {{ min: number, cefr: string }} ScoreRule
 * @typedef {{ mappingType: 'score_based', source: string, version: string, verifiedAt: string, skills: Record<string, ScoreRule[]> }} ScoreBasedMapping
 * @typedef {{ mappingType: 'level_based', source: string, version: string, verifiedAt: string, levels: { patterns: string[], cefr: string }[] }} LevelBasedMapping
 */

/** @type {Record<string, ScoreBasedMapping | LevelBasedMapping>} */
const EXAM_MAPPINGS = Object.freeze({
  BESTEP: {
    mappingType: 'score_based',
    source: 'school_policy_bestep',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { min: 130, cefr: 'C1' },
        { min: 100, cefr: 'B2' },
        { min: 70, cefr: 'B1' }
      ],
      reading: [
        { min: 130, cefr: 'C1' },
        { min: 100, cefr: 'B2' },
        { min: 70, cefr: 'B1' }
      ],
      speaking: [
        { min: 330, cefr: 'C1' },
        { min: 280, cefr: 'B2' }
      ],
      writing: [
        { min: 330, cefr: 'C1' },
        { min: 280, cefr: 'B2' }
      ]
    }
  },
  TOEIC: {
    mappingType: 'score_based',
    source: 'official_ets',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { min: 490, cefr: 'C1' },
        { min: 400, cefr: 'B2' },
        { min: 275, cefr: 'B1' },
        { min: 110, cefr: 'A2' },
        { min: 60, cefr: 'A1' }
      ],
      reading: [
        { min: 455, cefr: 'C1' },
        { min: 385, cefr: 'B2' },
        { min: 275, cefr: 'B1' },
        { min: 115, cefr: 'A2' },
        { min: 60, cefr: 'A1' }
      ]
    }
  },
  TOEIC_SW: {
    mappingType: 'score_based',
    source: 'official_ets',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      speaking: [
        { min: 180, cefr: 'C1' },
        { min: 160, cefr: 'B2' },
        { min: 120, cefr: 'B1' },
        { min: 90, cefr: 'A2' },
        { min: 50, cefr: 'A1' }
      ],
      writing: [
        { min: 180, cefr: 'C1' },
        { min: 150, cefr: 'B2' },
        { min: 120, cefr: 'B1' },
        { min: 70, cefr: 'A2' },
        { min: 30, cefr: 'A1' }
      ]
    }
  },
  IELTS: {
    mappingType: 'score_based',
    source: 'official_ielts',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { min: 8.5, cefr: 'C2' },
        { min: 7.0, cefr: 'C1' },
        { min: 5.5, cefr: 'B2' },
        { min: 4.0, cefr: 'B1' },
        { min: 3.0, cefr: 'A2' },
        { min: 2.0, cefr: 'A1' }
      ],
      reading: [
        { min: 8.5, cefr: 'C2' },
        { min: 7.0, cefr: 'C1' },
        { min: 5.5, cefr: 'B2' },
        { min: 4.0, cefr: 'B1' },
        { min: 3.0, cefr: 'A2' },
        { min: 2.0, cefr: 'A1' }
      ],
      speaking: [
        { min: 8.5, cefr: 'C2' },
        { min: 7.0, cefr: 'C1' },
        { min: 5.5, cefr: 'B2' },
        { min: 4.0, cefr: 'B1' },
        { min: 3.0, cefr: 'A2' },
        { min: 2.0, cefr: 'A1' }
      ],
      writing: [
        { min: 8.5, cefr: 'C2' },
        { min: 7.0, cefr: 'C1' },
        { min: 5.5, cefr: 'B2' },
        { min: 4.0, cefr: 'B1' },
        { min: 3.0, cefr: 'A2' },
        { min: 2.0, cefr: 'A1' }
      ]
    }
  },
  TOEFL_ITP: {
    mappingType: 'score_based',
    source: 'official_ets',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { min: 62, cefr: 'C1' },
        { min: 55, cefr: 'B2' },
        { min: 46, cefr: 'B1' },
        { min: 38, cefr: 'A2' }
      ],
      reading: [
        { min: 60, cefr: 'C1' },
        { min: 55, cefr: 'B2' },
        { min: 41, cefr: 'B1' },
        { min: 33, cefr: 'A2' }
      ]
    }
  },
  TOEFL_IBT_LEGACY: {
    mappingType: 'score_based',
    source: 'official_ets',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      reading: [
        { min: 29, cefr: 'C2' },
        { min: 24, cefr: 'C1' },
        { min: 18, cefr: 'B2' },
        { min: 6, cefr: 'B1' },
        { min: 3, cefr: 'A2' },
        { min: 0, cefr: 'A1' }
      ],
      listening: [
        { min: 28, cefr: 'C2' },
        { min: 22, cefr: 'C1' },
        { min: 17, cefr: 'B2' },
        { min: 9, cefr: 'B1' },
        { min: 4, cefr: 'A2' },
        { min: 0, cefr: 'A1' }
      ],
      speaking: [
        { min: 28, cefr: 'C2' },
        { min: 25, cefr: 'C1' },
        { min: 20, cefr: 'B2' },
        { min: 16, cefr: 'B1' },
        { min: 10, cefr: 'A2' },
        { min: 0, cefr: 'A1' }
      ],
      writing: [
        { min: 29, cefr: 'C2' },
        { min: 24, cefr: 'C1' },
        { min: 17, cefr: 'B2' },
        { min: 13, cefr: 'B1' },
        { min: 7, cefr: 'A2' },
        { min: 0, cefr: 'A1' }
      ]
    }
  },
  TOEFL_IBT_2026: {
    mappingType: 'score_based',
    source: 'official_ets',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      reading: [
        { min: 6, cefr: 'C2' },
        { min: 5, cefr: 'C1' },
        { min: 4, cefr: 'B2' },
        { min: 3, cefr: 'B1' },
        { min: 2, cefr: 'A2' },
        { min: 1, cefr: 'A1' }
      ],
      listening: [
        { min: 6, cefr: 'C2' },
        { min: 5, cefr: 'C1' },
        { min: 4, cefr: 'B2' },
        { min: 3, cefr: 'B1' },
        { min: 2, cefr: 'A2' },
        { min: 1, cefr: 'A1' }
      ],
      speaking: [
        { min: 6, cefr: 'C2' },
        { min: 5, cefr: 'C1' },
        { min: 4, cefr: 'B2' },
        { min: 3, cefr: 'B1' },
        { min: 2, cefr: 'A2' },
        { min: 1, cefr: 'A1' }
      ],
      writing: [
        { min: 6, cefr: 'C2' },
        { min: 5, cefr: 'C1' },
        { min: 4, cefr: 'B2' },
        { min: 3, cefr: 'B1' },
        { min: 2, cefr: 'A2' },
        { min: 1, cefr: 'A1' }
      ]
    }
  },
  GEPT: {
    mappingType: 'level_based',
    source: 'official_gept',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    levels: [
      { patterns: ['中高級', 'high-intermediate', 'high intermediate'], cefr: 'B2' },
      { patterns: ['優級', 'superior'], cefr: 'C2' },
      { patterns: ['初級', 'elementary'], cefr: 'A2' },
      { patterns: ['高級', 'advanced'], cefr: 'C1' },
      { patterns: ['中級', 'intermediate'], cefr: 'B1' }
    ]
  },
  CAMBRIDGE: {
    mappingType: 'level_based',
    source: 'official_cambridge',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    levels: [
      { patterns: ['c2 proficiency', 'cpe', 'c2'], cefr: 'C2' },
      { patterns: ['c1 advanced', 'cae', 'c1'], cefr: 'C1' },
      { patterns: ['b2 first', 'fce', 'b2'], cefr: 'B2' },
      { patterns: ['b1 preliminary', 'pet', 'b1'], cefr: 'B1' },
      { patterns: ['a2 key', 'ket', 'a2'], cefr: 'A2' }
    ]
  }
});

const SCORE_BASED_CODES = new Set(
  Object.entries(EXAM_MAPPINGS)
    .filter(([, m]) => m.mappingType === 'score_based')
    .map(([k]) => k)
);

const LEVEL_BASED_CODES = new Set(
  Object.entries(EXAM_MAPPINGS)
    .filter(([, m]) => m.mappingType === 'level_based')
    .map(([k]) => k)
);

const SCORE_RANGES = Object.freeze({
  BESTEP: {
    listening: { min: 0, max: 140 },
    reading: { min: 0, max: 140 },
    speaking: { min: 0, max: 360 },
    writing: { min: 0, max: 360 }
  },
  TOEIC: {
    listening: { min: 0, max: 495 },
    reading: { min: 0, max: 495 }
  },
  TOEIC_SW: {
    speaking: { min: 0, max: 200 },
    writing: { min: 0, max: 200 }
  },
  IELTS: {
    listening: { min: 0, max: 9 },
    reading: { min: 0, max: 9 },
    speaking: { min: 0, max: 9 },
    writing: { min: 0, max: 9 }
  },
  TOEFL_ITP: {
    listening: { min: 0, max: 68 },
    reading: { min: 0, max: 67 }
  },
  TOEFL_IBT_LEGACY: {
    listening: { min: 0, max: 30 },
    reading: { min: 0, max: 30 },
    speaking: { min: 0, max: 30 },
    writing: { min: 0, max: 30 }
  },
  TOEFL_IBT_2026: {
    listening: { min: 1, max: 6 },
    reading: { min: 1, max: 6 },
    speaking: { min: 1, max: 6 },
    writing: { min: 1, max: 6 }
  }
});

function normAlias(s) {
  return String(s || '')
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasKey(s) {
  const n = normAlias(s);
  if (/[\u3400-\u9FFF]/.test(n)) return n;
  return n.toLowerCase();
}

/** 全圖樣以長度降序比對，避免「高級」誤命中「中高級」之子字串 */
function matchLevelInString(levelStr, mapping) {
  if (mapping.mappingType !== 'level_based') return null;
  const hay = normAlias(levelStr).toLowerCase();
  if (!hay) return null;
  const pairs = [];
  for (const entry of mapping.levels) {
    for (const p of entry.patterns) {
      const pl = p.toLowerCase();
      pairs.push({ p: pl, cefr: entry.cefr, len: pl.length });
    }
  }
  pairs.sort((a, b) => b.len - a.len);
  for (const { p, cefr } of pairs) {
    if (hay.includes(p)) return cefr;
  }
  return null;
}

const EXPLICIT_ALIAS_MAP = (() => {
  const entries = [
    ['培力英檢', 'BESTEP'],
    ['培力', 'BESTEP'],
    ['BESTEP', 'BESTEP'],
    ['培力英檢(BESTEP)', 'BESTEP'],
    ['多益', 'TOEIC'],
    ['TOEIC', 'TOEIC'],
    ['多益聽力與閱讀測驗', 'TOEIC'],
    ['多益聽力與閱讀測驗(TOEIC)', 'TOEIC'],
    ['TOEIC_SW', 'TOEIC_SW'],
    ['TOEIC SW', 'TOEIC_SW'],
    ['TOEIC S&W', 'TOEIC_SW'],
    ['TOEIC Speaking and Writing', 'TOEIC_SW'],
    ['多益口說寫作', 'TOEIC_SW'],
    ['多益口說與寫作測驗', 'TOEIC_SW'],
    ['多益口說測驗', 'TOEIC_SW'],
    ['多益寫作測驗', 'TOEIC_SW'],
    ['雅思', 'IELTS'],
    ['IELTS', 'IELTS'],
    ['雅思(IELTS)', 'IELTS'],
    ['TOEFL_ITP', 'TOEFL_ITP'],
    ['TOEFL ITP', 'TOEFL_ITP'],
    ['TOEFL-ITP', 'TOEFL_ITP'],
    ['托福紙筆測驗', 'TOEFL_ITP'],
    ['托福紙筆測驗(TOEFL ITP)', 'TOEFL_ITP'],
    ['托福紙筆測驗(TOEFLITP)', 'TOEFL_ITP'],
    ['托福紙筆測驗(TOEFL-ITP)', 'TOEFL_ITP'],
    ['多益口說寫作(TOEIC_SW)', 'TOEIC_SW'],
    ['TOEFL_IBT_LEGACY', 'TOEFL_IBT_LEGACY'],
    ['TOEFL iBT 舊制', 'TOEFL_IBT_LEGACY'],
    ['托福網路化測驗舊制', 'TOEFL_IBT_LEGACY'],
    ['TOEFL_IBT_2026', 'TOEFL_IBT_2026'],
    ['TOEFL iBT 新制', 'TOEFL_IBT_2026'],
    ['托福網路化測驗新制', 'TOEFL_IBT_2026'],
    ['TOEFL 2026', 'TOEFL_IBT_2026'],
    ['全民英檢', 'GEPT'],
    ['GEPT', 'GEPT'],
    ['全民英檢(GEPT)', 'GEPT'],
    ['全民英檢初級', 'GEPT'],
    ['全民英檢中級', 'GEPT'],
    ['全民英檢中高級', 'GEPT'],
    ['全民英檢高級', 'GEPT'],
    ['全民英檢優級', 'GEPT'],
    ['劍橋英檢', 'CAMBRIDGE'],
    ['Cambridge', 'CAMBRIDGE'],
    ['CAMBRIDGE', 'CAMBRIDGE'],
    ['劍橋英檢(Cambridge)', 'CAMBRIDGE'],
    ['劍橋英檢(CAMBRIDGE)', 'CAMBRIDGE'],
    ['劍橋英檢 FCE', 'CAMBRIDGE'],
    ['劍橋英檢 CAE', 'CAMBRIDGE']
  ];
  const m = new Map();
  for (const [k, v] of entries) {
    m.set(aliasKey(k), v);
  }
  return m;
})();

function isAmbiguousToeflOnly(raw) {
  const n = normAlias(raw);
  if (n === '托福') return true;
  return /^toefl$/i.test(n);
}

function isGenericToeflIbt(raw) {
  const k = aliasKey(raw);
  const n = normAlias(raw);
  if (k === 'toefl_ibt') return true;
  if (k === 'toeflibt') return true;
  if (k === 'toefl ibt') return true;
  if (k === 'toefl-ibt') return true;
  if (n === '托福網路化測驗') return true;
  if (/舊制|新制/.test(n)) return false;
  if (/^托福網路化測驗\(/i.test(n)) return true;
  return false;
}

/**
 * @param {string} input
 * @param {{ examDate?: string|null }} [options]
 * @returns {{ code: string, reason: string|null }}
 */
function normalizeExamType(input, { examDate } = {}) {
  const examDateIso = examDate != null ? examDate : null;
  const raw = String(input || '').trim();
  if (!raw) {
    return { code: '', reason: 'UNKNOWN_EXAM_TYPE' };
  }
  if (isAmbiguousToeflOnly(raw)) {
    return { code: '', reason: 'AMBIGUOUS_TOEFL_TYPE' };
  }

  const explicit = EXPLICIT_ALIAS_MAP.get(aliasKey(raw));
  if (explicit) {
    return { code: explicit, reason: null };
  }

  if (isGenericToeflIbt(raw)) {
    if (!examDateIso || !/^\d{4}-\d{2}-\d{2}$/.test(String(examDateIso))) {
      return { code: '', reason: 'TOEFL_IBT_NEEDS_EXAM_DATE' };
    }
    const code = examDateIso >= TOEFL_IBT_CUTOFF_DATE ? 'TOEFL_IBT_2026' : 'TOEFL_IBT_LEGACY';
    return { code, reason: null };
  }

  return { code: '', reason: 'UNKNOWN_EXAM_TYPE' };
}

function getMappingMeta(examType) {
  const key = String(examType || '').trim();
  const m = EXAM_MAPPINGS[key];
  if (!m) return null;
  if (m.mappingType === 'score_based') {
    return {
      mappingType: m.mappingType,
      source: m.source,
      version: m.version,
      verifiedAt: m.verifiedAt,
      skills: m.skills
    };
  }
  return {
    mappingType: m.mappingType,
    source: m.source,
    version: m.version,
    verifiedAt: m.verifiedAt,
    levels: m.levels
  };
}

function isScoreBasedExam(examType) {
  return SCORE_BASED_CODES.has(String(examType || '').trim());
}

function isLevelBasedExam(examType) {
  return LEVEL_BASED_CODES.has(String(examType || '').trim());
}

function normalizeSkill(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  return SKILLS.includes(s) ? s : null;
}

function parseRawScore(rawScore) {
  if (rawScore == null || rawScore === '') return null;
  const score = Number(String(rawScore).replace(/,/g, '').trim());
  if (!Number.isFinite(score)) return null;
  return score;
}

function mapScoreToCefrFromRules(score, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const sorted = [...rules].sort((a, b) => b.min - a.min);
  const matched = sorted.find((r) => score >= r.min);
  return matched ? matched.cefr : null;
}

function baseMetaForExam(examType) {
  const m = getMappingMeta(examType);
  if (!m) {
    return {
      mappingType: 'score_based',
      source: 'unknown',
      version: VERSION,
      verifiedAt: VERIFIED_AT
    };
  }
  return {
    mappingType: m.mappingType,
    source: m.source,
    version: m.version,
    verifiedAt: m.verifiedAt
  };
}

function failScore(params) {
  const { examType, skill, rawScore, reason, resolvedType } = params;
  const t = resolvedType || examType;
  const meta = baseMetaForExam(t);
  return {
    examType: t != null ? t : null,
    mappingType: 'score_based',
    skill: skill != null ? skill : null,
    rawScore: rawScore !== undefined ? rawScore : null,
    cefr: null,
    cefrRank: null,
    isMapped: false,
    source: meta.source,
    version: meta.version,
    verifiedAt: meta.verifiedAt,
    reason
  };
}

/**
 * @param {{ examType: string, skill: string, rawScore: unknown, examDate?: string|null }} params
 */
function inferCefrFromScore(params) {
  const { examType: examTypeIn, skill, rawScore, examDate = null } = params || {};
  const metaIn = baseMetaForExam(examTypeIn);

  const normalizedSkill = normalizeSkill(skill);
  if (!normalizedSkill) {
    return failScore({
      examType: examTypeIn,
      skill,
      rawScore,
      reason: 'UNSUPPORTED_SKILL',
      resolvedType: examTypeIn
    });
  }

  const score = parseRawScore(rawScore);
  if (score == null) {
    return failScore({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore,
      reason: 'INVALID_RAW_SCORE',
      resolvedType: examTypeIn
    });
  }

  let resolvedType = String(examTypeIn || '').trim();

  if (!SCORE_BASED_CODES.has(resolvedType)) {
    const norm = normalizeExamType(examTypeIn, { examDate });
    if (norm.reason === 'AMBIGUOUS_TOEFL_TYPE') {
      return {
        examType: examTypeIn,
        mappingType: 'score_based',
        skill: normalizedSkill,
        rawScore: score,
        cefr: null,
        cefrRank: null,
        isMapped: false,
        source: metaIn.source,
        version: VERSION,
        verifiedAt: VERIFIED_AT,
        reason: 'AMBIGUOUS_TOEFL_TYPE'
      };
    }
    if (!norm.code || norm.reason === 'UNKNOWN_EXAM_TYPE' || norm.reason === 'TOEFL_IBT_NEEDS_EXAM_DATE') {
      return failScore({
        examType: examTypeIn,
        skill: normalizedSkill,
        rawScore: score,
        reason: 'UNSUPPORTED_EXAM_TYPE',
        resolvedType: examTypeIn
      });
    }
    resolvedType = norm.code;
  }

  if (!SCORE_BASED_CODES.has(resolvedType)) {
    return failScore({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'UNSUPPORTED_EXAM_TYPE',
      resolvedType
    });
  }

  const mapping = EXAM_MAPPINGS[resolvedType];
  const rules = mapping.skills[normalizedSkill];
  if (!Array.isArray(rules) || rules.length === 0) {
    return failScore({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'UNSUPPORTED_SKILL_FOR_EXAM',
      resolvedType
    });
  }

  const range = SCORE_RANGES[resolvedType]?.[normalizedSkill] || null;
  if (range && (score < range.min || score > range.max)) {
    return failScore({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'SCORE_OUT_OF_RANGE',
      resolvedType
    });
  }

  const cefr = mapScoreToCefrFromRules(score, rules);
  if (!cefr) {
    return failScore({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'BELOW_MIN_THRESHOLD',
      resolvedType
    });
  }

  const cefrRank = getCefrRank(cefr);
  const meta = baseMetaForExam(resolvedType);
  return {
    examType: resolvedType,
    mappingType: 'score_based',
    skill: normalizedSkill,
    rawScore: score,
    cefr,
    cefrRank,
    isMapped: true,
    source: meta.source,
    version: meta.version,
    verifiedAt: meta.verifiedAt,
    reason: 'MAPPED'
  };
}

/**
 * @param {{ examType: string, level: string, examDate?: string|null }} params
 */
function inferCefrFromLevel(params) {
  const { examType: examTypeIn, level } = params || {};
  const examType = String(examTypeIn || '').trim();
  const meta = EXAM_MAPPINGS[examType];
  const fail = (reason) => ({
    examType: examType || null,
    mappingType: 'level_based',
    level: level != null ? String(level) : null,
    cefr: null,
    cefrRank: null,
    isMapped: false,
    source: meta ? meta.source : 'unknown',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    reason
  });

  if (!meta || meta.mappingType !== 'level_based') {
    return fail('UNSUPPORTED_EXAM_TYPE');
  }

  const levelStr = level == null ? '' : String(level).trim();
  if (!levelStr) {
    return fail('LEVEL_REQUIRED_FOR_MAPPING');
  }

  const cefr = matchLevelInString(levelStr, meta);
  if (!cefr) {
    return fail('INVALID_LEVEL');
  }

  return {
    examType,
    mappingType: 'level_based',
    level: levelStr,
    cefr,
    cefrRank: getCefrRank(cefr),
    isMapped: true,
    source: meta.source,
    version: meta.version,
    verifiedAt: meta.verifiedAt,
    reason: 'MAPPED'
  };
}

/** @deprecated 改用 isScoreBasedExam；保留供過渡 */
function examTypeHasAnyScoreThreshold(examType) {
  return isScoreBasedExam(examType);
}

module.exports = {
  MAPPING_VERSION,
  TOEFL_IBT_CUTOFF_DATE,
  EXAM_MAPPINGS,
  normalizeExamType,
  inferCefrFromScore,
  inferCefrFromLevel,
  getMappingMeta,
  isScoreBasedExam,
  isLevelBasedExam,
  examTypeHasAnyScoreThreshold,
  SCORE_RANGES
};
