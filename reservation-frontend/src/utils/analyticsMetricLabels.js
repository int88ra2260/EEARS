/**
 * 趨勢／報表相關：後端 metrics 鍵 → 行政可讀中文標題
 * 未知鍵請在 UI 顯示「（未定義指標）」
 */

export const TREND_METRIC_LABELS = {
  participationRate: '參與率',
  avgParticipationCount: '平均簽到次數',
  bestepPassRate: 'BESTEP 通過率',
  exemptionApprovedRate: '抵免核准率',
  riskHighCount: '高風險學生數',
  highRiskCount: '高風險學生數',
  riskLevelDistribution: '風險等級分布',
  violationRate: '違規率',
  attendanceRate: '出席率',
  improvementRate: '改善率',
  surveyCompletionRate: '問卷完成率',
  waiverRate: '抵免率',
  bestepRegistrationRate: 'BESTEP 報考率',
  teachingCompositeScore: '教學綜合指標（proxy）',
  teacherImpact: '教學綜合指標（proxy，API 鍵）',
  attainmentRate: '達標率（僅適用 LJ canonical 情境；趨勢表多為班級口徑，請勿逕自解讀為 LJ）',
};

export function trendMetricTitle(key) {
  const base = TREND_METRIC_LABELS[key];
  if (base) return base;
  return `${key}（未定義指標）`;
}

const RISK_LEVEL_ZH = { low: '低', medium: '中', high: '高' };

/** 將趨勢表單元格格式化為中文可讀（避免 raw JSON） */
export function formatTrendMetricCell(key, value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    if (key === 'riskLevelDistribution' && value && typeof value === 'object') {
      const parts = ['low', 'medium', 'high']
        .map((k) => {
          const n = value[k];
          if (n == null) return null;
          return `${RISK_LEVEL_ZH[k] || k}：${n} 人`;
        })
        .filter(Boolean);
      return parts.length ? parts.join('；') : '—';
    }
    return '（複合資料）';
  }
  if (typeof value === 'number') {
    if (
      key === 'participationRate' ||
      key === 'bestepPassRate' ||
      key === 'exemptionApprovedRate' ||
      key === 'violationRate' ||
      key === 'attendanceRate' ||
      key === 'improvementRate' ||
      key === 'surveyCompletionRate' ||
      key === 'waiverRate' ||
      key === 'bestepRegistrationRate' ||
      key === 'attainmentRate'
    ) {
      return `${Number(value).toFixed(1)}%`;
    }
    return String(value);
  }
  return String(value);
}
