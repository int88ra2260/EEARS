/** 學習成效分析：給非開發人員看的直白用語 */

export const OBSERVATION_NOTE = '數字用來比較趨勢，不是「參加就一定進步」。';

/**
 * UI 顯示用最小樣本人數（與後端 offerings MIN_GROWTH_SAMPLE=10 對齊）。
 * - 細項分析：低於此門檻遮蔽平均進步／進步率
 * - 資源效益進階估計：低於此門檻不顯示該列
 * 注意：後端 evidenceLevel「medium」常另需約 30 人，那是資料完整度標籤，不是顯示門檻。
 */
export const LA_MIN_DISPLAY_SAMPLE = 10;

export const ESTIMATE_METHODS = Object.freeze({
  descriptive: {
    title: '實際進步（描述）',
    lead: '有前後測的學生，工具原始分進步的平均。跨英檢不宜直接互比。',
  },
  matching: {
    title: '背景相近學生比較',
    lead: '找程度、系所相近但沒參加的學生當對照，比較兩邊進步差（觀察估計）。',
  },
  ipw: {
    title: '依背景加權比較',
    lead: '依「誰比較可能參加」調整權重後再比進步，用來和上一欄交叉核對（觀察估計）。',
  },
  aipw: {
    title: '綜合校正估計',
    lead: '同時校正「誰會參加」與「預期會進步多少」。三種算法方向一致時較可信；仍非因果證明。',
  },
});

export function labelEstimateType(type) {
  const t = String(type || '').toLowerCase();
  if (!t) return '—';
  if (t.includes('aipw') || t.includes('doubly')) return ESTIMATE_METHODS.aipw.title;
  if (t.includes('weighted') || t.includes('ipw')) return ESTIMATE_METHODS.ipw.title;
  if (t.includes('matched') || t.includes('quasi')) return ESTIMATE_METHODS.matching.title;
  if (t.includes('adjusted') || t.includes('value_added') || t.includes('ols')) return '校正後進步';
  if (t.includes('descriptive') || t.includes('raw')) return ESTIMATE_METHODS.descriptive.title;
  return type;
}

export const EVIDENCE_LEVEL_LABELS = Object.freeze({
  high: '資料完整',
  medium: '尚可',
  medium_low: '偏少',
  low: '資料較少',
  descriptive_medium: '尚可',
  descriptive_low: '資料較少',
  quasi_causal_matched_medium: '尚可',
  quasi_causal_matched_low: '資料較少',
  quasi_causal_observational_medium: '尚可',
  quasi_causal_observational_low: '資料較少',
  quasi_causal_weighted_medium: '尚可',
  quasi_causal_weighted_low: '資料較少',
});

export const BALANCE_QUALITY_LABELS = Object.freeze({
  good: '背景接近',
  caution: '背景略有差異',
  poor: '背景差異大',
});

export const RESOURCE_TYPE_LABELS = Object.freeze({
  GE: '通識英文',
  EAP: 'EAP 寫作／學術英文',
  ESP: 'ESP 專業英文',
  ENGLISH_TABLE: 'English Table',
  ENGLISH_CLUB: 'English Club',
  JOB_TALK: 'Job Talk',
  INTERNATIONAL_FORUM: 'International Forum',
  WORKSHOP: '工作坊',
  TUTOR_IN_PERSON: '實體一對一諮詢',
  TUTOR_ONLINE: '線上一對一諮詢',
  ACTIVITY_OTHER: '其他活動',
  COURSE_OTHER: '其他課程',
});

export const SKILL_LABELS = Object.freeze({
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
  interaction: '互動',
  mediation: '調整',
  overall: '整體',
});
