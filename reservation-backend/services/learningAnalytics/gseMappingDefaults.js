'use strict';

/**
 * Global Scale of English (GSE) 與 CEFR、各英檢對照預設表。
 * GSE 來源：Pearson GSE White Paper Table 2 (2016)；英檢錨點來源見各 mapping source。
 */

const VERSION = '2026-v1';
const VERIFIED_AT = '2026-07-06';

/** @typedef {{ cefr: string, subLevel?: string, label: string, gseMin: number, gseMax: number }} GseCefrBand */

/** Pearson Table 2 — GSE 與 CEFR（含子區間，非等距） */
const GSE_CEFR_BANDS = Object.freeze([
  { cefr: 'BELOW_A1', subLevel: 'BELOW_TOURIST', label: 'Below A1 / Below Tourist', gseMin: 10, gseMax: 12 },
  { cefr: 'BELOW_A1', subLevel: 'TOURIST', label: 'Below A1 / Tourist', gseMin: 13, gseMax: 21 },
  { cefr: 'A1', label: 'A1', gseMin: 22, gseMax: 29 },
  { cefr: 'A2', subLevel: 'A2', label: 'A2', gseMin: 30, gseMax: 35 },
  { cefr: 'A2', subLevel: 'A2_PLUS', label: 'A2+', gseMin: 36, gseMax: 42 },
  { cefr: 'B1', subLevel: 'B1', label: 'B1', gseMin: 43, gseMax: 50 },
  { cefr: 'B1', subLevel: 'B1_PLUS', label: 'B1+', gseMin: 51, gseMax: 58 },
  { cefr: 'B2', subLevel: 'B2', label: 'B2', gseMin: 59, gseMax: 66 },
  { cefr: 'B2', subLevel: 'B2_PLUS', label: 'B2+', gseMin: 67, gseMax: 75 },
  { cefr: 'C1', label: 'C1', gseMin: 76, gseMax: 84 },
  { cefr: 'C2', label: 'C2', gseMin: 85, gseMax: 90 },
]);

/** CEFR 主等級 → GSE 區間（彙整用） */
const GSE_CEFR_SUMMARY = Object.freeze({
  BELOW_A1: { gseMin: 10, gseMax: 21, midpoint: 15.5 },
  A1: { gseMin: 22, gseMax: 29, midpoint: 25.5 },
  A2: { gseMin: 30, gseMax: 42, midpoint: 36 },
  B1: { gseMin: 43, gseMax: 58, midpoint: 50.5 },
  B2: { gseMin: 59, gseMax: 75, midpoint: 67 },
  C1: { gseMin: 76, gseMax: 84, midpoint: 80 },
  C2: { gseMin: 85, gseMax: 90, midpoint: 87.5 },
});

/**
 * @typedef {{ rawMin: number, gse: number }} GseAnchor
 * @typedef {{ mappingType: 'score_anchors', source: string, confidence: 'official'|'estimated', version: string, verifiedAt: string, skills: Record<string, GseAnchor[]> }} ScoreAnchorMapping
 * @typedef {{ mappingType: 'level_midpoint', source: string, confidence: 'estimated', version: string, verifiedAt: string, levels: { patterns: string[], cefr: string, gseMidpoint: number }[] }} LevelMidpointMapping
 */

/** 各英檢原始分 → GSE 錨點（區間內線性插值） */
const EXAM_GSE_MAPPINGS = Object.freeze({
  IELTS: {
    mappingType: 'score_anchors',
    source: 'pearson_gse_ielts_concordance_2020',
    confidence: 'official',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 9.0, gse: 90 },
        { rawMin: 8.5, gse: 89 },
        { rawMin: 8.0, gse: 84 },
        { rawMin: 7.5, gse: 76 },
        { rawMin: 7.0, gse: 66 },
        { rawMin: 6.5, gse: 60 },
        { rawMin: 6.0, gse: 54 },
        { rawMin: 5.5, gse: 46 },
        { rawMin: 5.0, gse: 38 },
        { rawMin: 4.5, gse: 32 },
        { rawMin: 4.0, gse: 26 },
        { rawMin: 3.0, gse: 24 },
        { rawMin: 2.0, gse: 22 },
      ],
      reading: [
        { rawMin: 9.0, gse: 90 },
        { rawMin: 8.5, gse: 89 },
        { rawMin: 8.0, gse: 84 },
        { rawMin: 7.5, gse: 76 },
        { rawMin: 7.0, gse: 66 },
        { rawMin: 6.5, gse: 60 },
        { rawMin: 6.0, gse: 54 },
        { rawMin: 5.5, gse: 46 },
        { rawMin: 5.0, gse: 38 },
        { rawMin: 4.5, gse: 32 },
        { rawMin: 4.0, gse: 26 },
        { rawMin: 3.0, gse: 24 },
        { rawMin: 2.0, gse: 22 },
      ],
      speaking: [
        { rawMin: 9.0, gse: 90 },
        { rawMin: 8.5, gse: 89 },
        { rawMin: 8.0, gse: 84 },
        { rawMin: 7.5, gse: 76 },
        { rawMin: 7.0, gse: 66 },
        { rawMin: 6.5, gse: 60 },
        { rawMin: 6.0, gse: 54 },
        { rawMin: 5.5, gse: 46 },
        { rawMin: 5.0, gse: 38 },
        { rawMin: 4.5, gse: 32 },
        { rawMin: 4.0, gse: 26 },
        { rawMin: 3.0, gse: 24 },
        { rawMin: 2.0, gse: 22 },
      ],
      writing: [
        { rawMin: 9.0, gse: 90 },
        { rawMin: 8.5, gse: 89 },
        { rawMin: 8.0, gse: 84 },
        { rawMin: 7.5, gse: 76 },
        { rawMin: 7.0, gse: 66 },
        { rawMin: 6.5, gse: 60 },
        { rawMin: 6.0, gse: 54 },
        { rawMin: 5.5, gse: 46 },
        { rawMin: 5.0, gse: 38 },
        { rawMin: 4.5, gse: 32 },
        { rawMin: 4.0, gse: 26 },
        { rawMin: 3.0, gse: 24 },
        { rawMin: 2.0, gse: 22 },
      ],
    },
  },
  TOEIC: {
    mappingType: 'score_anchors',
    source: 'ets_cefr_cutoffs_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 490, gse: 76 },
        { rawMin: 400, gse: 59 },
        { rawMin: 275, gse: 43 },
        { rawMin: 110, gse: 30 },
        { rawMin: 60, gse: 22 },
      ],
      reading: [
        { rawMin: 455, gse: 76 },
        { rawMin: 385, gse: 59 },
        { rawMin: 275, gse: 43 },
        { rawMin: 115, gse: 30 },
        { rawMin: 60, gse: 22 },
      ],
    },
  },
  TOEIC_SW: {
    mappingType: 'score_anchors',
    source: 'ets_cefr_cutoffs_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      speaking: [
        { rawMin: 180, gse: 76 },
        { rawMin: 160, gse: 59 },
        { rawMin: 120, gse: 43 },
        { rawMin: 90, gse: 30 },
        { rawMin: 50, gse: 22 },
      ],
      writing: [
        { rawMin: 180, gse: 76 },
        { rawMin: 150, gse: 59 },
        { rawMin: 120, gse: 43 },
        { rawMin: 70, gse: 30 },
        { rawMin: 30, gse: 22 },
      ],
    },
  },
  TOEFL_ITP: {
    mappingType: 'score_anchors',
    source: 'ets_cefr_cutoffs_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 62, gse: 76 },
        { rawMin: 55, gse: 59 },
        { rawMin: 46, gse: 43 },
        { rawMin: 38, gse: 30 },
      ],
      reading: [
        { rawMin: 60, gse: 76 },
        { rawMin: 55, gse: 59 },
        { rawMin: 41, gse: 43 },
        { rawMin: 33, gse: 30 },
      ],
    },
  },
  TOEFL_IBT_LEGACY: {
    mappingType: 'score_anchors',
    source: 'ets_cefr_cutoffs_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 28, gse: 85 },
        { rawMin: 22, gse: 76 },
        { rawMin: 17, gse: 59 },
        { rawMin: 9, gse: 43 },
        { rawMin: 4, gse: 30 },
        { rawMin: 0, gse: 22 },
      ],
      reading: [
        { rawMin: 29, gse: 85 },
        { rawMin: 24, gse: 76 },
        { rawMin: 18, gse: 59 },
        { rawMin: 6, gse: 43 },
        { rawMin: 3, gse: 30 },
        { rawMin: 0, gse: 22 },
      ],
      speaking: [
        { rawMin: 28, gse: 85 },
        { rawMin: 25, gse: 76 },
        { rawMin: 20, gse: 59 },
        { rawMin: 16, gse: 43 },
        { rawMin: 10, gse: 30 },
        { rawMin: 0, gse: 22 },
      ],
      writing: [
        { rawMin: 29, gse: 85 },
        { rawMin: 24, gse: 76 },
        { rawMin: 17, gse: 59 },
        { rawMin: 13, gse: 43 },
        { rawMin: 7, gse: 30 },
        { rawMin: 0, gse: 22 },
      ],
    },
  },
  TOEFL_IBT_2026: {
    mappingType: 'score_anchors',
    source: 'ets_cefr_cutoffs_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 6, gse: 85 },
        { rawMin: 5, gse: 76 },
        { rawMin: 4, gse: 59 },
        { rawMin: 3, gse: 43 },
        { rawMin: 2, gse: 30 },
        { rawMin: 1, gse: 22 },
      ],
      reading: [
        { rawMin: 6, gse: 85 },
        { rawMin: 5, gse: 76 },
        { rawMin: 4, gse: 59 },
        { rawMin: 3, gse: 43 },
        { rawMin: 2, gse: 30 },
        { rawMin: 1, gse: 22 },
      ],
      speaking: [
        { rawMin: 6, gse: 85 },
        { rawMin: 5, gse: 76 },
        { rawMin: 4, gse: 59 },
        { rawMin: 3, gse: 43 },
        { rawMin: 2, gse: 30 },
        { rawMin: 1, gse: 22 },
      ],
      writing: [
        { rawMin: 6, gse: 85 },
        { rawMin: 5, gse: 76 },
        { rawMin: 4, gse: 59 },
        { rawMin: 3, gse: 43 },
        { rawMin: 2, gse: 30 },
        { rawMin: 1, gse: 22 },
      ],
    },
  },
  BESTEP: {
    mappingType: 'score_anchors',
    source: 'school_policy_bestep_gse_interpolation',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    skills: {
      listening: [
        { rawMin: 130, gse: 76 },
        { rawMin: 100, gse: 59 },
        { rawMin: 70, gse: 43 },
      ],
      reading: [
        { rawMin: 130, gse: 76 },
        { rawMin: 100, gse: 59 },
        { rawMin: 70, gse: 43 },
      ],
      speaking: [
        { rawMin: 330, gse: 76 },
        { rawMin: 280, gse: 59 },
      ],
      writing: [
        { rawMin: 330, gse: 76 },
        { rawMin: 280, gse: 59 },
      ],
    },
  },
  GEPT: {
    mappingType: 'level_midpoint',
    source: 'lttc_gept_cefr_linking_gse_midpoint',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    levels: [
      { patterns: ['優級', 'superior'], cefr: 'C2', gseMidpoint: 87.5 },
      { patterns: ['高級', 'advanced'], cefr: 'C1', gseMidpoint: 80 },
      { patterns: ['中高級', 'high-intermediate', 'high intermediate'], cefr: 'B2', gseMidpoint: 67 },
      { patterns: ['中級', 'intermediate'], cefr: 'B1', gseMidpoint: 50.5 },
      { patterns: ['初級', 'elementary'], cefr: 'A2', gseMidpoint: 36 },
    ],
  },
  CAMBRIDGE: {
    mappingType: 'level_midpoint',
    source: 'cambridge_exam_level_gse_midpoint',
    confidence: 'estimated',
    version: VERSION,
    verifiedAt: VERIFIED_AT,
    levels: [
      { patterns: ['c2 proficiency', 'cpe', 'c2'], cefr: 'C2', gseMidpoint: 87.5 },
      { patterns: ['c1 advanced', 'cae', 'c1'], cefr: 'C1', gseMidpoint: 80 },
      { patterns: ['b2 first', 'fce', 'b2'], cefr: 'B2', gseMidpoint: 67 },
      { patterns: ['b1 preliminary', 'pet', 'b1'], cefr: 'B1', gseMidpoint: 50.5 },
      { patterns: ['a2 key', 'ket', 'a2'], cefr: 'A2', gseMidpoint: 36 },
    ],
  },
});

const EXAM_LABELS = Object.freeze({
  IELTS: 'IELTS',
  TOEIC: 'TOEIC L&R',
  TOEIC_SW: 'TOEIC S&W',
  TOEFL_ITP: 'TOEFL ITP',
  TOEFL_IBT_LEGACY: 'TOEFL iBT（2026/01/21 前）',
  TOEFL_IBT_2026: 'TOEFL iBT（2026/01/21 起）',
  BESTEP: 'BESTEP',
  GEPT: '全民英檢 GEPT',
  CAMBRIDGE: 'Cambridge English',
});

module.exports = {
  VERSION,
  VERIFIED_AT,
  GSE_CEFR_BANDS,
  GSE_CEFR_SUMMARY,
  EXAM_GSE_MAPPINGS,
  EXAM_LABELS,
};
