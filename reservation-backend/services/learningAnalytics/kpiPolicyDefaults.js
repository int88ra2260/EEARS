'use strict';

const { getDefaultInstrumentThresholds } = require('./kpiInstrumentThresholds');

const POLICY_SCHEMA_VERSION = 'kpi-policy.v1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 內建政策範本。執行報表時 semesterId 由請求帶入作為名冊分母。
 */
function buildBuiltinPolicyDefinitions() {
  const instruments = getDefaultInstrumentThresholds();

  const ay115SittingPair = {
    schemaVersion: POLICY_SCHEMA_VERSION,
    academicYearLabel: '115',
    population: {
      gradeMin: 2,
      gradeMax: 4,
      note: '依選定學期在學名冊年級：大二至大四',
    },
    evidence: {
      timeWindow: 'lifetime',
      status: 'valid',
      sittingKey: 'attemptId',
    },
    dimensions: [
      {
        id: 'lr_pair',
        label: '聽讀達標',
        skills: ['listening', 'reading'],
        kind: 'pair',
        requireCompleteSkills: true,
        proofSelection: 'highest_combined',
      },
      {
        id: 'sw_pair',
        label: '說寫達標',
        skills: ['speaking', 'writing'],
        kind: 'pair',
        requireCompleteSkills: true,
        proofSelection: 'highest_combined',
      },
    ],
    includeSkillBreakdown: true,
    instruments,
    notes: [
      '官方 KPI：聽+讀／說+寫兩欄人數與比例。',
      '分母：選定學期在學名冊，且年級為大二至大四。',
      '同場以 EtExamAttempt（attemptId）為準。',
      '成對缺一技能：該組不計達標；分項對照仍可依單項 CEFR 計算。',
      '一人多場通過：證明列取最高合計。',
      'TOEIC L&R 採 sum_only（合計 ≥785），與校方舉例一致。',
    ],
  };

  const legacyPerSkill = {
    schemaVersion: POLICY_SCHEMA_VERSION,
    academicYearLabel: null,
    population: {
      gradeMin: null,
      gradeMax: null,
      note: '不限年級（名冊全體）',
    },
    evidence: {
      timeWindow: 'lifetime',
      status: 'valid',
      sittingKey: 'attemptId',
    },
    dimensions: [
      {
        id: 'listening',
        label: '聽力達標',
        skills: ['listening'],
        kind: 'skill',
        requireCompleteSkills: true,
        proofSelection: 'highest_rank',
        minCefrRank: 4,
      },
      {
        id: 'reading',
        label: '閱讀達標',
        skills: ['reading'],
        kind: 'skill',
        requireCompleteSkills: true,
        proofSelection: 'highest_rank',
        minCefrRank: 4,
      },
      {
        id: 'speaking',
        label: '口說達標',
        skills: ['speaking'],
        kind: 'skill',
        requireCompleteSkills: true,
        proofSelection: 'highest_rank',
        minCefrRank: 4,
      },
      {
        id: 'writing',
        label: '寫作達標',
        skills: ['writing'],
        kind: 'skill',
        requireCompleteSkills: true,
        proofSelection: 'highest_rank',
        minCefrRank: 4,
      },
    ],
    includeSkillBreakdown: false,
    instruments,
    notes: [
      '舊制：聽／讀／說／寫單項歷史最佳 CEFR ≥ B2 即達標（可跨考試／學期）。',
      '分母預設為名冊全體（不限年級）；可複製後自行設定年級範圍。',
    ],
  };

  return [
    {
      policyKey: 'ay115-sitting-pair-sum',
      name: '115 學年 · 同場合計（聽讀／說寫）',
      academicYear: '115',
      description: '官方 KPI：同一次測驗聽+讀或說+寫合計達 B2 門檻；名冊限大二至大四。',
      definition: ay115SittingPair,
      isBuiltin: true,
    },
    {
      policyKey: 'legacy-per-skill-best',
      name: '舊制 · 單項歷史最佳 B2',
      academicYear: null,
      description: '四技能分開：任一歷史紀錄達 B2 即該技能達標。',
      definition: legacyPerSkill,
      isBuiltin: true,
    },
  ];
}

function getBuiltinPolicySeeds() {
  return buildBuiltinPolicyDefinitions().map((row) => ({
    ...row,
    definition: clone(row.definition),
  }));
}

module.exports = {
  POLICY_SCHEMA_VERSION,
  getBuiltinPolicySeeds,
};
