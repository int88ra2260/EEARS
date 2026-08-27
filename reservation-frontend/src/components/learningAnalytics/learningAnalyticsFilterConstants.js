/** 與後端 learningAnalyticsFilterUtils QUERY_PARAM_KEYS 對齊（LA 群體分析篩選） */
export const FILTER_PARAM_KEYS = [
  'semester',
  'snapshot_version',
  'cohort',
  'college',
  'department',
  'baseline_level',
  'exposure_level',
  'retest_flag',
  'is_b2plus',
  'instrument',
  'skill',
  'evidence_quality',
  'matching_caliper',
];

export const DEFAULT_LA_FILTERS = Object.freeze({
  semester: '',
  cohort: '',
  department: '',
  college: '',
  snapshot_version: '',
  baseline_level: '',
  exposure_level: '',
  retest_flag: '',
  is_b2plus: '',
  instrument: '',
  skill: '',
  evidence_quality: '',
  matching_caliper: '',
});

export const FILTER_LABELS = Object.freeze({
  semester: '學期',
  snapshot_version: '資料版本',
  cohort: '入學年度',
  college: '學院',
  department: '系所',
  baseline_level: '起始英語能力',
  exposure_level: '英語資源參與量',
  retest_flag: '曾重測英檢',
  is_b2plus: 'B2+ 達標',
  instrument: '英檢工具',
  skill: '技能',
  evidence_quality: '資料完整度',
  matching_caliper: '對照要多接近',
});

/** 篩選欄位說明（以標籤旁驚嘆號提示顯示） */
export const FILTER_FIELD_HINTS = Object.freeze({
  semester: '僅影響 B2+ 認證率等學期相關區塊。',
  cohort: '選項來自分析資料中的入學年度，以及模組設定中手動新增的項目。',
  college: '選項來自分析資料中的學院，以及模組設定中手動新增的項目。',
  department: '選項來自分析資料中的系所，以及模組設定中手動新增的項目。',
  baseline_level: '依學生基線英語能力（CEFR 等級）篩選群體。',
  exposure_level: '依考前累積的英語課程與活動參與時數分級。',
  retest_flag: '是否曾有前後測可計算成長的英檢紀錄。',
  is_b2plus: '是否已達 B2 以上認證（依分析快照計算）。',
  instrument: '篩選特定英檢工具之成績紀錄。',
  skill: '篩選特定技能維度（聽說讀寫等）之成長或成績。',
  evidence_quality: '依學生資料完整度（基線、英檢筆數等）篩選。',
  matching_caliper: '數字愈小，對照學生的背景要愈接近。多半可留空用預設。',
});

/** 使用者可讀的指標說明 */
export const LA_TERM_HELP = Object.freeze({
  gse: '能力分數：把不同英檢換成同一把尺，才能比進步。不是官方認證分數。',
  adjustedGrowth: '校正後進步：扣掉起始程度差異後的進步，較適合作群體比較。',
  modelRun: '分析紀錄：把目前篩選下的結果存下來，方便之後對照。',
});

export const EXPOSURE_LEVEL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'none', label: '無（考前未參與課程／活動）' },
  { value: 'low', label: '低（少於 10 小時）' },
  { value: 'medium', label: '中（10–30 小時）' },
  { value: 'high', label: '高（超過 30 小時）' },
];

export const BASELINE_LEVEL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'A1', label: 'A1（初級）' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
  { value: 'BELOW_A1', label: '低於 A1' },
];

export const INSTRUMENT_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'BESTEP', label: 'BESTEP' },
  { value: 'TOEIC', label: 'TOEIC' },
  { value: 'IELTS', label: 'IELTS' },
  { value: 'TOEFL', label: 'TOEFL' },
  { value: 'GEPT', label: 'GEPT' },
  { value: 'GSAT', label: 'GSAT（學測）' },
];

export const SKILL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'listening', label: '聽力' },
  { value: 'reading', label: '閱讀' },
  { value: 'speaking', label: '口說' },
  { value: 'writing', label: '寫作' },
  { value: 'interaction', label: '互動' },
  { value: 'mediation', label: '調整' },
  { value: 'overall', label: '整體' },
];

export const EVIDENCE_QUALITY_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'high', label: '高（資料完整）' },
  { value: 'medium', label: '中' },
  { value: 'medium_low', label: '中低' },
  { value: 'low', label: '低（資料較少）' },
];

export const TRI_STATE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'true', label: '是' },
  { value: 'false', label: '否' },
];

export function parseFiltersFromSearchParams(searchParams) {
  const parsed = { ...DEFAULT_LA_FILTERS };
  FILTER_PARAM_KEYS.forEach((key) => {
    if (key === 'snapshot_version') return;
    const value = searchParams.get(key);
    if (value != null && value !== '') parsed[key] = value;
  });
  return parsed;
}

export function filtersToApiParams(filters = {}) {
  const params = {};
  FILTER_PARAM_KEYS.forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value;
    }
  });
  return params;
}

export function buildDefaultFilters({ semester = '', snapshotVersion = '' } = {}) {
  return {
    ...DEFAULT_LA_FILTERS,
    semester,
    snapshot_version: snapshotVersion,
  };
}

export function countActiveFilters(filters = {}) {
  return FILTER_PARAM_KEYS.filter((key) => {
    if (key === 'snapshot_version') return false;
    const value = filters[key];
    return value !== undefined && value !== null && value !== '';
  }).length;
}
