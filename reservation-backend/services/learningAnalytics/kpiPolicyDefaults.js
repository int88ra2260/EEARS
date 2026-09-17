'use strict';

const { getDefaultInstrumentThresholds } = require('./kpiInstrumentThresholds');

const POLICY_SCHEMA_VERSION = 'kpi-policy.v1';

/** 已退役的內建政策鍵（ensure 時封存，避免與新八種並存） */
const RETIRED_BUILTIN_POLICY_KEYS = Object.freeze([
  'ay115-sitting-pair-sum',
  'legacy-per-skill-best',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const GRADE_GROUPS = [
  {
    suffix: 'g13',
    label: '大一至大三',
    population: {
      gradeMin: 1,
      gradeMax: 3,
      note: '依選定學期在學名冊年級：大一至大三',
    },
  },
  {
    suffix: 'g24',
    label: '大二至大四',
    population: {
      gradeMin: 2,
      gradeMax: 4,
      note: '依選定學期在學名冊年級：大二至大四',
    },
  },
];

/**
 * 四種成對規則 × 兩種年級 = 八種內建政策。
 * 皆計算聽讀／說寫是否達標；同類型考試；同場以同考試日期為準。
 */
const RULE_VARIANTS = [
  {
    key: 'bothcefr-samedate',
    shortName: '最嚴格',
    namePrefix: '最嚴格 · 同日雙科 CEFR≥B2',
    description: '同一類型考試、同一考試日期；聽+讀／說+寫兩科 CEFR 皆 ≥ B2。',
    pairAssembly: 'same_date',
    passMode: 'both_cefr',
    notes: [
      '官方成對：聽讀／說寫兩欄。',
      '同場定義：同一英檢工具 + 同一考試日期（可合併當日多筆 attempt）。',
      '達標：兩科 CEFR 皆 ≥ B2（不可單科未達而以總分補）。',
      '不可跨工具（例如聽用 TOEIC、讀用 BESTEP）。',
    ],
  },
  {
    key: 'bothcefr-crossdate',
    shortName: '放寬場次',
    namePrefix: '放寬場次 · 跨日雙科 CEFR≥B2',
    description: '同一類型考試、可跨不同考試日期；聽+讀／說+寫兩科 CEFR 皆 ≥ B2。',
    pairAssembly: 'cross_date',
    passMode: 'both_cefr',
    notes: [
      '官方成對：聽讀／說寫兩欄。',
      '同工具下可取不同日期的最佳聽／讀（或說／寫）再成對。',
      '達標：兩科 CEFR 皆 ≥ B2。',
      '不可跨工具。',
    ],
  },
  {
    key: 'sumraw-samedate',
    shortName: '放寬分項',
    namePrefix: '放寬分項 · 同日分數合計',
    description: '同一類型考試、同一考試日期；依工具分數加總門檻（如 TOEIC 聽讀≥785）判定。',
    pairAssembly: 'same_date',
    passMode: 'instrument',
    notes: [
      '官方成對：聽讀／說寫兩欄。',
      '同場定義：同一英檢工具 + 同一考試日期。',
      '達標：依各工具成對合計門檻（sum_raw／部分工具為 both_cefr）。',
      '例：TOEIC L&R 合計 ≥785（允許單科 CEFR 未達 B2）；BESTEP 聽讀≥200、說寫≥560。',
    ],
  },
  {
    key: 'sumraw-crossdate',
    shortName: '放寬分項+場次',
    namePrefix: '放寬分項+場次 · 跨日分數合計',
    description: '同一類型考試、可跨日期取各技能最佳後再依工具分數加總門檻判定。',
    pairAssembly: 'cross_date',
    passMode: 'instrument',
    notes: [
      '官方成對：聽讀／說寫兩欄。',
      '同工具下可跨日期組最佳聽／讀（或說／寫）後再合計。',
      '達標：依各工具成對合計門檻。',
      '不可跨工具。',
    ],
  },
];

function buildPairDimensions({ pairAssembly, passMode }) {
  const base = {
    kind: 'pair',
    requireCompleteSkills: true,
    proofSelection: 'highest_combined',
    pairAssembly,
  };
  if (passMode === 'both_cefr') {
    base.passMode = 'both_cefr';
    base.minCefrRank = 4;
  }
  // passMode === 'instrument' → 不設 passMode，沿用各工具門檻

  return [
    {
      ...base,
      id: 'lr_pair',
      label: '聽讀達標',
      skills: ['listening', 'reading'],
    },
    {
      ...base,
      id: 'sw_pair',
      label: '說寫達標',
      skills: ['speaking', 'writing'],
    },
  ];
}

function buildBuiltinPolicyDefinitions() {
  const instruments = getDefaultInstrumentThresholds();
  const policies = [];

  for (const rule of RULE_VARIANTS) {
    for (const grade of GRADE_GROUPS) {
      const policyKey = `pair-${rule.key}-${grade.suffix}`;
      const definition = {
        schemaVersion: POLICY_SCHEMA_VERSION,
        academicYearLabel: null,
        population: clone(grade.population),
        evidence: {
          timeWindow: 'lifetime',
          status: 'valid',
          sittingKey: 'examDate',
          pairAssembly: rule.pairAssembly,
        },
        dimensions: buildPairDimensions({
          pairAssembly: rule.pairAssembly,
          passMode: rule.passMode,
        }),
        includeSkillBreakdown: false,
        instruments,
        notes: [
          ...rule.notes,
          `分母：選定學期在學名冊，年級為${grade.label}。`,
          '一人多組通過：證明列取最高合計。',
        ],
      };

      policies.push({
        policyKey,
        name: `${rule.namePrefix} · ${grade.label}`,
        academicYear: null,
        description: `${rule.description} 名冊限${grade.label}。`,
        definition,
        isBuiltin: true,
      });
    }
  }

  return policies;
}

function getBuiltinPolicySeeds() {
  return buildBuiltinPolicyDefinitions().map((row) => ({
    ...row,
    definition: clone(row.definition),
  }));
}

/** 預設選用：最嚴格 · 大二至大四 */
const DEFAULT_BUILTIN_POLICY_KEY = 'pair-bothcefr-samedate-g24';

module.exports = {
  POLICY_SCHEMA_VERSION,
  RETIRED_BUILTIN_POLICY_KEYS,
  DEFAULT_BUILTIN_POLICY_KEY,
  getBuiltinPolicySeeds,
};
