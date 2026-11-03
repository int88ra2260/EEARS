/** 學習資源頁的閱讀說明。只描述既有 API 欄位，不計算新指標。 */

export const LEARNING_DETAIL_LINKS = Object.freeze([
  {
    id: 'skills',
    label: '開啟技能成長',
    to: '/admin/learning-analytics/skills',
    hint: '既有前後測與校正後進步。這頁的篩選不會自動帶過去。',
  },
  {
    id: 'offerings',
    label: '開啟課／師／活動',
    to: '/admin/learning-analytics/offerings',
    hint: '既有參與樣本與細項。',
  },
  {
    id: 'raw',
    label: '開啟原始資料',
    to: '/admin/learning-analytics/raw-data',
    hint: '回到既有可追溯的列，不在此重算。',
  },
]);

export function formatObservedCount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '—';
}

export function shouldApplyAnalyticsResult(requestSeq, latestSeq) {
  return requestSeq === latestSeq;
}

export function describeResourceCoverage(row) {
  const participants = row?.participantCount;
  const comparable = row?.growthSampleSize;
  if (participants == null || participants === '') return '參與人數尚未回傳';
  const participantCount = Number(participants);
  if (!Number.isFinite(participantCount)) return '參與人數尚未回傳';
  if (participantCount === 0) return '沒有人參與';
  if (comparable == null || comparable === '') return '有人參與，可比較樣本尚未回傳';
  const comparableCount = Number(comparable);
  if (!Number.isFinite(comparableCount)) return '有人參與，可比較樣本尚未回傳';
  if (comparableCount === 0) return '有人參與，但沒有可比較的前後測';
  if (row?.evidenceLevel === 'descriptive_low') return '可比較樣本偏少，不足以判讀差異';
  return '具有可比較的前後測紀錄';
}

export function resourceEventCount(exposureRows, resourceType) {
  const row = (exposureRows || []).find((item) => item?.resourceType === resourceType);
  if (!row || row.events == null || row.events === '') return null;
  return row.events;
}

export function offeringScopeLabel(semester) {
  const value = String(semester || '').trim();
  if (!value) return '目前範圍：跨學期';
  return `目前範圍：${value}`;
}

/**
 * 平均變化只在可比較樣本大於 0 時顯示數字。
 * null 不能經 Number() 變成 0。樣本為 0 時，即使原值是 0 也不顯示成已觀察到的 0.0。
 */
export function formatObservedDelta(value, sampleSize) {
  if (sampleSize === null || sampleSize === undefined || sampleSize === '') return '—';
  const sample = Number(sampleSize);
  if (!Number.isFinite(sample)) return '—';
  if (sample <= 0) return '無可比較樣本';
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n > 0) return `+${n.toFixed(1)}`;
  return n.toFixed(1);
}

export function describeResourceExposure(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const interpretations = [...new Set(list.map((row) => row?.interpretation).filter(Boolean))];
  const causalOpen = list.some((row) => row?.causalClaimAllowed === true);
  return {
    population: '參加過的人數是不重複學生數，不是資源事件次數。',
    absence: '沒有這一列，只表示這份快照沒有可用紀錄，不能推論學生沒有學習。',
    missing: '人數是 0 才是有效的零。沒有數值顯示為 —，不會改寫成未觀察。',
    anonymity: '這頁只依資源事件上的 studentId 彙總，不會把匿名軌跡配成某一位學生的姓名。',
    causation: causalOpen
      ? '其中一列沒有關閉因果宣稱。畫面仍不把它寫成該資源造成能力提升。'
      : '資源覆蓋是描述性關聯，不代表該資源造成能力提升。',
    apiInterpretation: interpretations.length === 1 ? interpretations[0] : '',
    evidence: '「資料夠不夠」沿用 API 的 evidenceLevel。這不是新的品質分數，也不是 Shadow 的即時報告。',
    exposure: '可觀察事件次數來自 skillExposure.events。它不是不重複學生數，也不是學習效果。',
  };
}
