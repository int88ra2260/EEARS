'use strict';

const { normalizeExamType, TOEFL_IBT_CUTOFF_DATE } = require('../learningJourney/utils/cefrScoreMapping');
const { normalizeCefrKey } = require('./learningAnalyticsCefrUtils');
const {
  VERSION,
  VERIFIED_AT,
  GSE_CEFR_BANDS,
  GSE_CEFR_SUMMARY,
  EXAM_GSE_MAPPINGS,
  EXAM_LABELS,
} = require('./gseMappingDefaults');

const SKILLS = ['listening', 'reading', 'speaking', 'writing'];
const GSE_MIN = 10;
const GSE_MAX = 90;

const SCORE_ANCHOR_CODES = new Set(
  Object.entries(EXAM_GSE_MAPPINGS)
    .filter(([, m]) => m.mappingType === 'score_anchors')
    .map(([k]) => k)
);

const LEVEL_MIDPOINT_CODES = new Set(
  Object.entries(EXAM_GSE_MAPPINGS)
    .filter(([, m]) => m.mappingType === 'level_midpoint')
    .map(([k]) => k)
);

function clampGse(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(GSE_MIN, Math.min(GSE_MAX, Math.round(value * 10) / 10));
}

function normalizeSkill(skill) {
  if (skill == null) return null;
  const s = String(skill).trim().toLowerCase();
  return SKILLS.includes(s) ? s : null;
}

function parseRawScore(rawScore) {
  if (rawScore == null || rawScore === '') return null;
  const score = Number(String(rawScore).replace(/,/g, '').trim());
  if (!Number.isFinite(score)) return null;
  return score;
}

function normAlias(s) {
  return String(s || '')
    .trim()
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchLevelInString(levelStr, mapping) {
  if (mapping.mappingType !== 'level_midpoint') return null;
  const hay = normAlias(levelStr).toLowerCase();
  if (!hay) return null;
  const pairs = [];
  for (const entry of mapping.levels) {
    for (const p of entry.patterns) {
      pairs.push({ pattern: normAlias(p).toLowerCase(), entry });
    }
  }
  pairs.sort((a, b) => b.pattern.length - a.pattern.length);
  for (const { pattern, entry } of pairs) {
    if (hay.includes(pattern)) return entry;
  }
  return null;
}

/**
 * 區間內線性插值：錨點 rawMin 遞減排列，gse 為該門檻對應的 GSE 下界。
 */
function mapScoreToGseFromAnchors(score, anchors) {
  if (!Array.isArray(anchors) || anchors.length === 0) return null;
  const sorted = [...anchors].sort((a, b) => b.rawMin - a.rawMin);
  const top = sorted[0];
  if (score >= top.rawMin) {
    if (sorted.length === 1) return clampGse(top.gse);
    const next = sorted[1];
    const span = top.rawMin - next.rawMin;
    if (span <= 0) return clampGse(top.gse);
    const ratio = Math.min(1, (score - top.rawMin) / span);
    return clampGse(top.gse + ratio * (GSE_MAX - top.gse));
  }
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const lower = sorted[i];
    const upper = sorted[i + 1];
    if (score >= upper.rawMin && score < lower.rawMin) {
      const span = lower.rawMin - upper.rawMin;
      if (span <= 0) return clampGse(upper.gse);
      const ratio = (score - upper.rawMin) / span;
      return clampGse(upper.gse + ratio * (lower.gse - upper.gse));
    }
  }
  const bottom = sorted[sorted.length - 1];
  if (score < bottom.rawMin) return null;
  return clampGse(bottom.gse);
}

function gseBandForScore(gse) {
  if (gse == null || !Number.isFinite(gse)) return null;
  for (const band of GSE_CEFR_BANDS) {
    if (gse >= band.gseMin && gse <= band.gseMax) return band;
  }
  if (gse < GSE_CEFR_BANDS[0].gseMin) return GSE_CEFR_BANDS[0];
  return GSE_CEFR_BANDS[GSE_CEFR_BANDS.length - 1];
}

function cefrToGseMidpoint(cefr) {
  const key = normalizeCefrKey(cefr);
  if (!key) return null;
  const summary = GSE_CEFR_SUMMARY[key];
  return summary ? summary.midpoint : null;
}

function gseToCefr(gse) {
  const band = gseBandForScore(gse);
  return band ? band.cefr : null;
}

function failGse(params) {
  const { examType, skill, rawScore, level, reason, resolvedType, confidence } = params;
  const meta = EXAM_GSE_MAPPINGS[resolvedType || examType] || {};
  return {
    examType: resolvedType || examType || null,
    skill: skill != null ? skill : null,
    level: level != null ? String(level) : null,
    rawScore: rawScore !== undefined ? rawScore : null,
    gse: null,
    cefr: null,
    confidence: confidence || meta.confidence || null,
    isMapped: false,
    source: meta.source || 'unknown',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    reason,
  };
}

function successGse(params) {
  const {
    examType, skill, rawScore, level, gse, cefr, confidence, mappingType, reason,
  } = params;
  const meta = EXAM_GSE_MAPPINGS[examType] || {};
  return {
    examType,
    mappingType,
    skill: skill != null ? skill : null,
    level: level != null ? String(level) : null,
    rawScore: rawScore !== undefined ? rawScore : null,
    gse: clampGse(gse),
    cefr: cefr || gseToCefr(gse),
    confidence: confidence || meta.confidence || null,
    isMapped: true,
    source: meta.source,
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    reason: reason || 'MAPPED',
  };
}

/**
 * 原始分 → GSE（優先使用英檢錨點表）
 * @param {{ examType: string, skill: string, rawScore: unknown, examDate?: string|null }} params
 */
function inferGseFromScore(params) {
  const { examType: examTypeIn, skill, rawScore, examDate = null } = params || {};
  const normalizedSkill = normalizeSkill(skill);
  if (!normalizedSkill) {
    return failGse({ examType: examTypeIn, skill, rawScore, reason: 'UNSUPPORTED_SKILL' });
  }

  const score = parseRawScore(rawScore);
  if (score == null) {
    return failGse({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore,
      reason: 'INVALID_RAW_SCORE',
    });
  }

  let resolvedType = String(examTypeIn || '').trim();
  if (!SCORE_ANCHOR_CODES.has(resolvedType)) {
    const norm = normalizeExamType(examTypeIn, { examDate });
    if (norm.reason === 'AMBIGUOUS_TOEFL_TYPE') {
      return failGse({
        examType: examTypeIn,
        skill: normalizedSkill,
        rawScore: score,
        reason: 'AMBIGUOUS_TOEFL_TYPE',
      });
    }
    if (!norm.code || norm.reason === 'UNKNOWN_EXAM_TYPE' || norm.reason === 'TOEFL_IBT_NEEDS_EXAM_DATE') {
      return failGse({
        examType: examTypeIn,
        skill: normalizedSkill,
        rawScore: score,
        reason: 'UNSUPPORTED_EXAM_TYPE',
      });
    }
    resolvedType = norm.code;
  }

  if (!SCORE_ANCHOR_CODES.has(resolvedType)) {
    return failGse({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'UNSUPPORTED_EXAM_TYPE',
      resolvedType,
    });
  }

  const mapping = EXAM_GSE_MAPPINGS[resolvedType];
  const anchors = mapping.skills[normalizedSkill];
  if (!Array.isArray(anchors) || anchors.length === 0) {
    return failGse({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'UNSUPPORTED_SKILL_FOR_EXAM',
      resolvedType,
    });
  }

  const gse = mapScoreToGseFromAnchors(score, anchors);
  if (gse == null) {
    return failGse({
      examType: examTypeIn,
      skill: normalizedSkill,
      rawScore: score,
      reason: 'BELOW_MIN_THRESHOLD',
      resolvedType,
      confidence: mapping.confidence,
    });
  }

  return successGse({
    examType: resolvedType,
    skill: normalizedSkill,
    rawScore: score,
    gse,
    confidence: mapping.confidence,
    mappingType: 'score_anchors',
  });
}

/**
 * 等級字串 → GSE（GEPT、Cambridge 等）
 * @param {{ examType: string, level: string }} params
 */
function inferGseFromLevel(params) {
  const { examType: examTypeIn, level } = params || {};
  const examType = String(examTypeIn || '').trim();
  const mapping = EXAM_GSE_MAPPINGS[examType];
  if (!mapping || mapping.mappingType !== 'level_midpoint') {
    return failGse({ examType, level, reason: 'UNSUPPORTED_EXAM_TYPE' });
  }

  const levelStr = level == null ? '' : String(level).trim();
  if (!levelStr) {
    return failGse({ examType, level, reason: 'LEVEL_REQUIRED_FOR_MAPPING' });
  }

  const matched = matchLevelInString(levelStr, mapping);
  if (!matched) {
    return failGse({ examType, level: levelStr, reason: 'INVALID_LEVEL', confidence: mapping.confidence });
  }

  return successGse({
    examType,
    level: levelStr,
    gse: matched.gseMidpoint,
    cefr: matched.cefr,
    confidence: mapping.confidence,
    mappingType: 'level_midpoint',
  });
}

/**
 * 僅 CEFR → GSE 區間中位數（降權用途）
 */
function inferGseFromCefr(cefr) {
  const midpoint = cefrToGseMidpoint(cefr);
  if (midpoint == null) {
    return failGse({ reason: 'INVALID_CEFR', confidence: 'estimated' });
  }
  return successGse({
    examType: null,
    gse: midpoint,
    cefr: normalizeCefrKey(cefr),
    confidence: 'estimated',
    mappingType: 'cefr_midpoint',
    reason: 'CEFR_MIDPOINT_FALLBACK',
  });
}

/**
 * 綜合推斷：有原始分優先，其次等級，最後 CEFR 中位數
 */
function inferGse({ examType, skill, rawScore, level, cefrLevel, examDate = null }) {
  if (rawScore != null && rawScore !== '') {
    const fromScore = inferGseFromScore({ examType, skill, rawScore, examDate });
    if (fromScore.isMapped) return fromScore;
    if (LEVEL_MIDPOINT_CODES.has(String(examType || '').trim()) && level) {
      const fromLevel = inferGseFromLevel({ examType, level });
      if (fromLevel.isMapped) return fromLevel;
    }
    if (cefrLevel) {
      const fromCefr = inferGseFromCefr(cefrLevel);
      if (fromCefr.isMapped) {
        return { ...fromCefr, reason: 'CEFR_FALLBACK_AFTER_SCORE_FAIL' };
      }
    }
    return fromScore;
  }

  if (level && LEVEL_MIDPOINT_CODES.has(String(examType || '').trim())) {
    const fromLevel = inferGseFromLevel({ examType, level });
    if (fromLevel.isMapped) return fromLevel;
  }

  if (cefrLevel) {
    return inferGseFromCefr(cefrLevel);
  }

  return failGse({ examType, skill, rawScore, level, reason: 'NO_INPUT' });
}

function listGseCefrBandsForReference() {
  return GSE_CEFR_BANDS.map((band) => ({
    ...band,
    midpoint: Math.round(((band.gseMin + band.gseMax) / 2) * 10) / 10,
    summary: GSE_CEFR_SUMMARY[band.cefr] || null,
  }));
}

function listExamGseMappingsForReference() {
  return Object.entries(EXAM_GSE_MAPPINGS).map(([examType, mapping]) => {
    const base = {
      examType,
      label: EXAM_LABELS[examType] || examType,
      mappingType: mapping.mappingType,
      source: mapping.source,
      confidence: mapping.confidence,
      version: mapping.version,
      verifiedAt: mapping.verifiedAt,
    };
    if (mapping.mappingType === 'score_anchors') {
      return {
        ...base,
        skills: Object.fromEntries(
          Object.entries(mapping.skills).map(([skill, anchors]) => [
            skill,
            [...anchors].sort((a, b) => a.rawMin - b.rawMin),
          ])
        ),
      };
    }
    return {
      ...base,
      levels: mapping.levels.map((row) => ({
        patterns: row.patterns,
        cefr: row.cefr,
        gseMidpoint: row.gseMidpoint,
        gseRange: GSE_CEFR_SUMMARY[row.cefr] || null,
      })),
    };
  });
}

function listGseMappingForSettings() {
  return {
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    scaleRange: { min: GSE_MIN, max: GSE_MAX },
    toeflIbtCutoffDate: TOEFL_IBT_CUTOFF_DATE,
    cefrBands: listGseCefrBandsForReference(),
    cefrSummary: GSE_CEFR_SUMMARY,
    examMappings: listExamGseMappingsForReference(),
    references: [
      {
        id: 'pearson_gse_whitepaper',
        title: 'Developing Global Scale of English Learning Objectives aligned to the Common European Framework',
        url: 'https://www.pearson.com/content/dam/one-dot-com/one-dot-com/english/TeacherResources/GSE/GSE-WhitePaper-Developing-LOs.pdf',
      },
      {
        id: 'pearson_gse_alignment',
        title: 'Alignment of the Global Scale of English to other scales (PTE, IELTS, TOEFL)',
        url: 'https://www.pearson.com/content/dam/one-dot-com/one-dot-com/english/TeacherResources/GSE/GSE-Alignment-other-scales.pdf',
      },
      {
        id: 'pearson_ielts_concordance',
        title: 'Concordance of PTE Academic (GSE) and IELTS Academic (2020)',
        url: 'https://www.pearson.com/content/dam/one-dot-com/one-dot-com/english/SupportingDocs/concordance-report.pdf',
      },
      {
        id: 'ets_toeic_cefr',
        title: 'Mapping the TOEIC Tests on the CEFR',
        url: 'https://www.ets.org/pdfs/toeic/toeic-mapping-cefr-reference.pdf',
      },
    ],
  };
}

module.exports = {
  VERSION,
  VERIFIED_AT,
  GSE_MIN,
  GSE_MAX,
  GSE_CEFR_BANDS,
  GSE_CEFR_SUMMARY,
  EXAM_GSE_MAPPINGS,
  inferGseFromScore,
  inferGseFromLevel,
  inferGseFromCefr,
  inferGse,
  gseToCefr,
  cefrToGseMidpoint,
  gseBandForScore,
  mapScoreToGseFromAnchors,
  listGseCefrBandsForReference,
  listExamGseMappingsForReference,
  listGseMappingForSettings,
};
