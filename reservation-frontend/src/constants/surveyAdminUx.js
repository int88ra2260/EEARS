/**
 * 問卷與回饋後台：對外文案（與 API 欄位值對應，僅供 UI）
 */

export const SURVEY_WORKFLOW_STEPS = [
  {
    id: 'create',
    title: '建立問卷',
    summary: '在問卷中心新增問卷主檔（名稱、用途說明）。',
    path: '/admin/survey-center',
    action: '前往問卷中心',
  },
  {
    id: 'publish',
    title: '編輯題目並發布',
    summary: '建立草稿版本 → 編輯題目結構 → 發布；學生端只會看到「已發布」版本。',
    path: '/admin/survey-center',
    action: '在列表按「編輯與發布」',
  },
  {
    id: 'rules',
    title: '設定何時要填',
    summary: '依學期、活動類型指定要填哪一份問卷、預約前或後、是否必填。',
    path: '/admin/survey-rules',
    action: '前往啟用規則',
  },
  {
    id: 'responses',
    title: '檢視作答與匯出',
    summary: '查看已送出作答、統計圖表；完整資料可匯出 JSON 或至資料匯入中心。',
    path: '/admin/survey-center',
    action: '在列表按「作答／統計」',
  },
  {
    id: 'legacy',
    title: '舊版 Excel 統計（相容）',
    summary: '依舊 surveyId 字串的歷史統計與 Excel，新問卷請優先使用問卷中心。',
    path: '/admin/surveys',
    action: '前往舊版問卷管理',
  },
];

export const SURVEY_PAGE_GUIDES = {
  center: {
    title: '問卷中心怎麼用？',
    intro: '這裡管理「問卷本身」：建立、編輯題目、發布版本，並連到作答與統計。下方列表每一列代表一份問卷。',
    bullets: [
      '新增：按右上角「新增問卷」，填寫名稱與問卷代碼。',
      '編輯題目：在該列按「編輯與發布」→ 建立草稿 → 編輯題目 → 發布。',
      '檢視／匯出作答：按「作答紀錄」或「統計」；完整備份可「下載問卷備份（JSON）」。',
      '讓學生何時要填：請至側欄「啟用規則」設定學期與活動條件。',
    ],
  },
  rules: {
    title: '啟用規則怎麼用？',
    intro: '問卷建立並發布後，在此指定「哪個學期、哪類活動、何時要填哪份問卷」。',
    bullets: [
      '新增規則：按「新增規則」，選學期、活動類型、問卷與版本。',
      '編輯／刪除：在列表右側「編輯」「刪除」。',
      '測試：可用下方「查詢目前生效規則」確認條件是否正確（進階人員可用模擬解析）。',
    ],
  },
  health: {
    title: '資料品質（維運）',
    intro: '供系統管理員檢查作答資料是否缺學期、缺版本等異常；一般填答與匯出請用問卷中心即可。',
    bullets: [
      '「總覽」分頁：滑鼠移到指標卡片可查看說明；綠色代表目前無異常。',
      '「問題清單」：列出需處理的作答，可連結至填答紀錄或答案對照。',
      '「修復工具」預設僅預覽；開啟實際寫入前請備份並輸入確認字串。',
    ],
  },
  mapping: {
    title: '答案對照（維運）',
    intro: '當題目代碼變更或新舊版題目不一致時，將舊答案對應到新題目；核准後才會納入統計。',
    bullets: [
      '請先選擇問卷，再按「自動建議對照」— 會先預覽勾選項目，確認後才建立。',
      '待核准可一次核准信心度 ≥ 0.9 的項目；拒絕時可填寫原因。',
      '列表顯示「舊代碼 → 新代碼」與信心度，核准前請核對問卷版本是否正確。',
    ],
  },
};

export const SURVEY_STATUS_LABELS = {
  published: '已發布',
  draft: '草稿',
  archived: '已封存',
  active: '使用中',
  inactive: '未啟用',
};

export const SURVEY_RULE_EFFECTIVE_LABELS = {
  active_now: { variant: 'success', label: '目前生效' },
  not_started: { variant: 'info', label: '尚未開始' },
  expired: { variant: 'secondary', label: '已過期' },
  disabled: { variant: 'dark', label: '已停用' },
  overridden_by_higher_priority: { variant: 'warning', label: '被較高優先覆蓋' },
};

export const ACTIVITY_TYPE_LABELS = {
  ET: 'English Table',
  EC: 'English Club',
  IF: 'International Forum',
  JT: 'Job Talk',
  GENERAL: '一般活動',
};

export const TRIGGER_MODE_LABELS = {
  before_reservation: '預約前必填',
  after_reservation: '預約後填寫',
  optional: '選填（不擋預約）',
};

export const FILL_SCOPE_LABELS = {
  once_per_semester: '每學期填一次',
  once_per_activity: '每類活動填一次',
  once_per_event: '每場活動填一次',
};

export const MAPPING_STATUS_LABELS = {
  pending: '待核准',
  approved: '已核准',
  rejected: '已拒絕',
};

export const MAPPING_STATUS_VARIANTS = {
  pending: 'warning',
  approved: 'success',
  rejected: 'secondary',
};

export const MAPPING_TYPE_LABELS = {
  manual: '手動建立',
  exact: '代碼完全相同',
  heuristic: '系統推測',
  deprecated_key_alias: '舊代碼別名',
};

export const HEALTH_METRIC_HINTS = {
  responsesTotal: '已關聯問卷的有效作答筆數。',
  orphanResponses: 'surveyId 為空的測試／殘留資料，可忽略或手動刪除。',
  missingSemesterCount: '未關聯學期 ID，可能影響學期篩選與統計。',
  missingVersionCount: '未關聯問卷版本，可能無法對照題目結構。',
  unresolvedSemesterCount: '與「缺少學期」相同，待治理補齊。',
  unresolvedVersionCount: '與「缺少版本」相同，待治理補齊。',
  unmatchedAnswersCount: '掃描範圍內各作答「無法對照題目」的加總（不含學號姓名）。',
  responsesWithUnmatched: '至少有一題無法對照 schema 的作答筆數。',
  fallbackRenderedResponsesCount: '含無法對照或缺 schema 的作答筆數。',
  eventsMissingSemester: '活動主檔未設定學期，可能影響規則與統計。',
};

/** 指標為 0 視為健康；responsesTotal 僅供參考 */
export function healthMetricCardVariant(key, value) {
  if (key === 'responsesTotal') return 'primary';
  if (key === 'orphanResponses') {
    const n = Number(value) || 0;
    return n === 0 ? 'success' : 'secondary';
  }
  const n = Number(value) || 0;
  if (n === 0) return 'success';
  if (
    [
      'missingSemesterCount',
      'missingVersionCount',
      'unmatchedAnswersCount',
      'responsesWithUnmatched',
    ].includes(key)
  ) {
    return n >= 50 ? 'danger' : 'warning';
  }
  return 'warning';
}

export function surveyLabelById(surveys, surveyId) {
  if (surveyId == null || surveyId === '') return '—';
  const s = (surveys || []).find((x) => String(x.id) === String(surveyId));
  return s?.title || s?.name || s?.surveyKey || `問卷 #${surveyId}`;
}

export function versionLabelById(versions, versionId) {
  if (versionId == null || versionId === '') return '—';
  const v = (versions || []).find((x) => String(x.id) === String(versionId));
  return v ? `第 ${v.versionNumber} 版` : `版本 #${versionId}`;
}

export const READINESS_GATE_LABELS = {
  'Not ready': '尚未就緒',
  'Ready with warnings': '有警告但可上線',
  Ready: '已就緒',
};

export const SURVEY_REPAIR_TYPE_LABELS = {
  semester: '補齊學期欄位',
  version: '重新對應版本',
  answers: '檢查答案格式',
  recommended: '建議修復（學期＋版本＋標準對照）',
};

export const HEALTH_METRIC_KEYS = [
  'responsesTotal',
  'orphanResponses',
  'missingSemesterCount',
  'missingVersionCount',
  'unresolvedSemesterCount',
  'unresolvedVersionCount',
  'unmatchedAnswersCount',
  'responsesWithUnmatched',
  'fallbackRenderedResponsesCount',
  'eventsMissingSemester',
];

export const HEALTH_METRIC_LABELS = {
  responsesTotal: '有效作答筆數',
  orphanResponses: '孤立測試資料（無問卷）',
  missingSemesterCount: '缺少學期',
  missingVersionCount: '缺少版本',
  unresolvedSemesterCount: '學期無法對應',
  unresolvedVersionCount: '版本無法對應',
  unmatchedAnswersCount: '無法對照題數（加總）',
  responsesWithUnmatched: '含無法對照題的作答',
  fallbackRenderedResponsesCount: '含異常的作答筆數',
  eventsMissingSemester: '活動缺少學期',
};

export function labelSurveyStatus(status) {
  const key = String(status || '').toLowerCase();
  return SURVEY_STATUS_LABELS[key] || status || '—';
}

export function surveyStatusBadgeVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'published' || key === 'active') return 'success';
  if (key === 'draft') return 'secondary';
  if (key === 'archived' || key === 'inactive') return 'dark';
  return 'secondary';
}

export function labelActivityType(code) {
  return ACTIVITY_TYPE_LABELS[code] || code || '—';
}

export function labelTriggerMode(code) {
  return TRIGGER_MODE_LABELS[code] || code || '—';
}

export function labelFillScope(code) {
  return FILL_SCOPE_LABELS[code] || code || '—';
}
