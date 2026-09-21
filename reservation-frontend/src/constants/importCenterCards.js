/**
 * 資料匯入中心卡片設定（P11 入口整合）
 * 僅描述既有功能入口，不新增後端 API。
 */

import { IMPORT_STATUS_TIER } from './importCenterStatus';

/**
 * @typedef {import('./importCenterStatus').ImportStatusTier} ImportStatusTier
 * @typedef {import('./importCenterStatus').ImportCenterKind} ImportCenterKind
 */

/**
 * @typedef {Object} ImportCenterCard
 * @property {string} id
 * @property {string} title
 * @property {ImportCenterKind} kind
 * @property {ImportStatusTier} statusTier
 * @property {string} [statusDetail] - 補充說明（不寫入狀態 Badge，例如「需先選活動」）
 * @property {string} description
 * @property {string} dataToImport - 要上傳／同步的資料（給使用者一眼看懂）
 * @property {string[]} affects - 匯入後實際影響的報表／功能（結果導向）
 * @property {string} [notFor] - 容易搞混時的反向說明
 * @property {string[]} impactModules - 影響模組標籤（次要）
 * @property {string} riskHint
 * @property {string} [routeAccess]
 * @property {string} [importPath]
 * @property {string} [historyPath]
 * @property {boolean} [templateOnTarget]
 * @property {string} [templateNote]
 * @property {string} [importNote]
 * @property {string} [pendingReason]
 * @property {import('./importCenterCards').ImportCenterSectionId} [section]
 * @property {boolean} [hideHistoryButton] - 隱藏「查看匯入紀錄」按鈕（無對應行為時）
 */

/** @typedef {typeof IMPORT_CENTER_SECTION[keyof typeof IMPORT_CENTER_SECTION]} ImportCenterSectionId */

/** 卡片分區（P14-2 UI） */
export const IMPORT_CENTER_SECTION = {
  FREQUENT: 'frequent',
  OPS: 'ops',
  EXPORT_PENDING: 'export_pending',
};

/** @type {Record<string, { id: string, title: string, description: string }>} */
export const IMPORT_CENTER_SECTION_META = {
  [IMPORT_CENTER_SECTION.FREQUENT]: {
    id: IMPORT_CENTER_SECTION.FREQUENT,
    title: '常用匯入',
    description: '請先對照「匯入什麼」與「會影響什麼」，再進入對應頁上傳；本頁不直接收檔。',
  },
  [IMPORT_CENTER_SECTION.OPS]: {
    id: IMPORT_CENTER_SECTION.OPS,
    title: '維運與查詢',
    description: '查詢匯入紀錄、同步狀態與維運摘要；非一般資料上傳入口。',
  },
  [IMPORT_CENTER_SECTION.EXPORT_PENDING]: {
    id: IMPORT_CENTER_SECTION.EXPORT_PENDING,
    title: '匯出與尚未啟用',
    description: '僅匯出或尚未提供 bulk 匯入之功能。',
  },
};

/**
 * 頁首常見任務導引（任務 → 應選哪張卡片）
 * @type {{ id: string, goal: string, steps: string[] }[]}
 */
export const IMPORT_CENTER_TASK_GUIDES = [
  {
    id: 'b2-kpi',
    goal: '計算某學期 B2 KPI（例如 115-1）',
    steps: [
      '先匯「學習歷程名冊」→ 決定該學期分母（在學／追蹤人口）',
      '再匯「英檢成績（學習歷程）」→ 作為達標證據（分子）',
      '最後到「學習成效分析 → KPI 報表」選同學期執行',
    ],
  },
  {
    id: 'class-roster',
    goal: '更新單一班級學生名單',
    steps: ['使用「班級名冊匯入」或「教務處修課名單」（可同步建班）'],
  },
  {
    id: 'bestep',
    goal: '更新培力英檢出席／成績',
    steps: ['使用「培力英檢（BESTEP）資料匯入」'],
  },
];

/** @type {ImportCenterCard[]} */
export const IMPORT_CENTER_CARDS = [
  {
    id: 'lj-enrollment',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '學習歷程名冊匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '依「學期」匯入在學／追蹤名冊，作為該學期學習歷程與 B2 KPI 的人口分母。',
    dataToImport: '學期追蹤名冊 Excel（系所、學院、班別、年級、學號、姓名）。匯入時請選對學期（如 115-1）。',
    affects: [
      'B2／學習成效 KPI 報表的分母人數',
      '英語學習歷程總覽、風險分析的涵蓋學生',
      '活動營運總覽的學期統計人口',
    ],
    notFor: '不是單班修課名單，也不是尚未啟用的「全校學生主檔」。',
    impactModules: ['英語學習歷程中心', 'KPI 報表', '活動營運總覽'],
    riskHint: '名冊為學期維度；刪除批次會重算總覽統計，建議由管理員操作。',
    routeAccess: '/admin/learning-journey/import',
    importPath: '/admin/learning-journey/import',
    historyPath: '/admin/learning-journey/import',
    templateOnTarget: true,
    templateNote: '於學習歷程匯入頁下載名冊範例',
  },
  {
    id: 'lj-exam',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '英檢成績匯入（學習歷程）',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '匯入外部英檢成績（多種測驗、四技能與 CEFR），供達標與最佳技能統計。',
    dataToImport: '外部英檢成績 Excel（測驗類型、四技能分數、CEFR、測驗日期等）。',
    affects: [
      'B2／學習成效 KPI 的達標人數（分子）',
      '學生個人學習歷程的最佳技能與考試紀錄',
      '分析報表中的英檢相關指標',
    ],
    notFor: '不算人口分母；算某學期 B2 KPI 請先匯「學習歷程名冊」。',
    impactModules: ['英語學習歷程中心', 'KPI 報表'],
    riskHint: '可選 replace 模式覆蓋衝突資料；匯入後會觸發最佳技能重算。',
    routeAccess: '/admin/learning-journey/import',
    importPath: '/admin/learning-journey/import',
    historyPath: '/admin/learning-journey/import',
    templateOnTarget: true,
    templateNote: '於學習歷程匯入頁下載考試成績範例',
  },
  {
    id: 'ewl-sync',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '英文寫作工坊（EWL）同步',
    kind: 'sync',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '從 EWL API 同步預約與簽到，補齊學習歷程活動參與。',
    dataToImport: '無需 Excel；由 EWL 寫作工坊 API 依日期區間拉取預約／簽到。',
    affects: [
      '學生學習歷程中的 EWL 活動參與紀錄',
      '中心分析報表與活動營運總覽的相關統計',
    ],
    impactModules: ['英語學習歷程中心', '分析報表', '活動營運總覽'],
    riskHint: '以 ConsultationTimeID 去重；建議先預覽再寫入。',
    routeAccess: '/admin/learning-journey/ewl-sync',
    importPath: '/admin/learning-journey/ewl-sync',
    historyPath: '/admin/learning-journey/operations',
    hideHistoryButton: false,
    templateOnTarget: false,
    templateNote: '無需 Excel；由 EWL API 拉取',
    importNote: '請先預覽同步確認筆數，再確認寫入。',
  },
  {
    id: 'class-roster',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '班級名冊匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '匯入單一班級的修課學生名單，供班級與教學儀表板使用。',
    dataToImport: '班級 roster Excel，或選課系統修課名單 PDF（含學期、課程、教師、學生）。',
    affects: [
      '該班級的學生名單與參與統計',
      '教學儀表板／班級總覽顯示',
    ],
    notFor: '不會成為全校 B2 KPI 分母；全學期人口請用「學習歷程名冊」。',
    impactModules: ['班級與參與', '教學儀表板'],
    riskHint: '匯入會寫入該班級名單；請確認學期與班級名稱正確。',
    routeAccess: '/admin/classes',
    importPath: '/admin/classes',
    hideHistoryButton: true,
    templateOnTarget: true,
    templateNote: '於班級列表頁「匯入名單」可下載 API 範本',
  },
  {
    id: 'bestep',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '培力英檢（BESTEP）資料匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    hideHistoryButton: true,
    description: '匯入 BESTEP 出席與成績，並可同步至學習歷程考試紀錄。',
    dataToImport: 'BESTEP 出席（LR/SW）與成績 Excel（聽讀說寫、CEFR）；僅「報名成功」學生會寫入出席。',
    affects: [
      '培力英檢管理與班級 BESTEP 檢視',
      '學習歷程 exam_attempts 與學習成效分析投影',
    ],
    impactModules: ['培力英檢管理', '班級 BESTEP', '學習歷程投影', '學習成效分析'],
    riskHint:
      '成績匯入後請稍候再查學習分析頁。若需補寫舊學期，可執行 npm run lj:promote-bestep。',
    routeAccess: '/admin/english-test/import',
    importPath: '/admin/english-test/import',
    templateOnTarget: true,
    templateNote: '於匯入頁可下載成績與出席範例；匯入失敗時可下載錯誤報表',
  },
  {
    id: 'event-checkin-import',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '活動參與／刷卡簽到匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    hideHistoryButton: true,
    statusDetail: '需先選擇活動',
    description: '依刷卡機 Excel 比對學號，寫入指定活動的簽到狀態。',
    dataToImport: '刷卡機匯出 Excel（學號／卡號與刷卡時間）。請先開啟該活動明細。',
    affects: [
      '該活動的簽到／出席狀態',
      '活動參與統計報表',
    ],
    impactModules: ['活動與預約', '簽到參與統計'],
    riskHint: '請確認刷卡日期與活動日相同；匯入會直接寫入簽到狀態。',
    routeAccess: '/admin/operations',
    importPath: '/admin/operations',
    importNote: '請先至活動列表開啟活動明細，再使用「匯入與匯出」分頁上傳',
    templateOnTarget: false,
    templateNote: '目前無範本下載',
  },
  {
    id: 'import-run-history',
    section: IMPORT_CENTER_SECTION.OPS,
    title: '匯入紀錄中心',
    kind: 'sync',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '跨模組查詢最近匯入、同步與稽核摘要；具權限者可刪除並回滾部分批次。',
    dataToImport: '無檔案上傳；查詢既有匯入／同步紀錄。',
    affects: [
      '可追溯各模組匯入結果與錯誤摘要',
      '具權限時可回滾可追蹤的匯入批次',
    ],
    impactModules: ['英語學習歷程', '班級', 'BESTEP', '活動', '系統稽核'],
    riskHint: '刪除會回滾可追蹤批次；部分舊紀錄僅有稽核摘要。',
    routeAccess: '/admin/import-center/runs',
    importPath: '/admin/import-center/runs',
    hideHistoryButton: true,
    importNote: '整合 learning_journey、job_runs 與 audit_logs；無明細 API 的紀錄會標示為「無明細」。',
  },
  {
    id: 'lj-operations',
    section: IMPORT_CENTER_SECTION.OPS,
    title: '學習歷程同步與維運',
    kind: 'sync',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '查看 operation runs、資料新鮮度；可對指定學期做健康檢查與 projection 重建。',
    dataToImport: '無 Excel；選擇學期後執行健康檢查或 projection 重建。',
    affects: [
      '學習歷程衍生統計與四技能最佳成績重算結果',
      '維運頁的資料新鮮度摘要',
    ],
    notFor: '名冊／成績上傳請改走「學習歷程匯入」頁。',
    impactModules: ['英語學習歷程中心', '資料維運紀錄'],
    riskHint: '重建 projection 會重算四技能最佳成績，請由管理員操作。',
    routeAccess: '/admin/learning-journey/operations',
    importPath: '/admin/learning-journey/operations',
    historyPath: '/admin/learning-journey/operations',
    templateOnTarget: false,
  },
  {
    id: 'survey-export',
    section: IMPORT_CENTER_SECTION.EXPORT_PENDING,
    title: '問卷資料匯出',
    kind: 'export',
    statusTier: IMPORT_STATUS_TIER.EXPORT_ONLY,
    hideHistoryButton: true,
    description: '匯出問卷作答與統計（JSON／XLSX）；目前無問卷 bulk Excel 匯入。',
    dataToImport: '無匯入；僅匯出既有問卷作答與統計。',
    affects: ['問卷中心可下載的作答／統計檔案'],
    impactModules: ['問卷中心', '問卷模組'],
    riskHint: '匯出含個資，請依校內資料保管規範處理檔案。',
    routeAccess: '/admin/survey-center',
    importPath: '/admin/survey-center',
    templateOnTarget: false,
    templateNote: '無問卷匯入範本',
  },
  {
    id: 'student-master',
    section: IMPORT_CENTER_SECTION.EXPORT_PENDING,
    title: '全校學生主檔匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.PENDING,
    hideHistoryButton: true,
    description: '規劃中的全校學生基本資料 bulk 匯入（學號、姓名、系所、身份別、Email）。',
    dataToImport: '尚未開放。若要匯學期在學名單，請改用「學習歷程名冊匯入」。',
    affects: ['規劃影響預約、學習歷程與報表；目前尚未寫入任何資料'],
    notFor: '請勿假設與名冊匯入相同格式。',
    impactModules: ['預約', '學習歷程', '報表'],
    riskHint: '尚無對應匯入流程。',
    pendingReason: '專案中未發現獨立學生主檔 Excel 匯入頁；追蹤名冊請使用「學習歷程名冊匯入」。',
  },
  {
    id: 'activity-bulk',
    section: IMPORT_CENTER_SECTION.EXPORT_PENDING,
    title: '活動資料匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.DISABLED,
    hideHistoryButton: true,
    description: '規劃中的活動清單、場次與能力指標批次匯入。',
    dataToImport: '尚未開放；請於活動列表手動新增或批次建立。',
    affects: ['規劃影響活動與預約；目前無 bulk 寫入'],
    impactModules: ['活動與預約'],
    riskHint: '尚無 bulk 匯入。',
    pendingReason: '目前無活動 bulk Excel 匯入頁；活動請於活動列表新增或批次建立。',
  },
  {
    id: 'course-records',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '教務處修課名單匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '匯入教務處 EAP／ESP／GE 修課名單，寫入學習歷程修課紀錄，並可自動建立班級。',
    dataToImport: '教務處原始修課名單 Excel（多工作表）。建議先預覽再確認寫入。',
    affects: [
      '學生學習歷程的修課紀錄與事件時間軸',
      '可自動建立／更新班級名冊',
      '相關學生的 analytic 衍生層重建',
    ],
    notFor: '不是 B2 KPI 全學期分母；分母請用「學習歷程名冊」。',
    impactModules: ['學習歷程', '學生 profile', '事件時間軸', '班級與參與'],
    riskHint: '確認寫入需超級管理員權限；寫入後會重建相關學生 analytic。',
    routeAccess: '/admin/learning-journey/import',
    importPath: '/admin/learning-journey/import',
    templateOnTarget: false,
    templateNote: '使用教務處原始修課名單 Excel（多工作表）',
    importNote: '建議先「預覽匯入」，確認無誤後再「確認寫入」。',
  },
];

/** @param {ImportStatusTier} tier */
export function filterCardsByStatusTier(tier) {
  return IMPORT_CENTER_CARDS.filter((c) => c.statusTier === tier);
}

export function getUsableImportCenterCards() {
  return IMPORT_CENTER_CARDS.filter(
    (c) =>
      c.statusTier === IMPORT_STATUS_TIER.ENABLED ||
      c.statusTier === IMPORT_STATUS_TIER.EXPORT_ONLY,
  );
}

export function getPlannedImportCenterCards() {
  return IMPORT_CENTER_CARDS.filter(
    (c) =>
      c.statusTier === IMPORT_STATUS_TIER.PENDING ||
      c.statusTier === IMPORT_STATUS_TIER.DISABLED,
  );
}

const SECTION_ORDER = [
  IMPORT_CENTER_SECTION.FREQUENT,
  IMPORT_CENTER_SECTION.OPS,
  IMPORT_CENTER_SECTION.EXPORT_PENDING,
];

/** @param {ImportCenterSectionId} sectionId */
export function getImportCenterCardsBySection(sectionId) {
  return IMPORT_CENTER_CARDS.filter((c) => (c.section || IMPORT_CENTER_SECTION.FREQUENT) === sectionId);
}

export function getImportCenterSections() {
  return SECTION_ORDER.map((sectionId) => ({
    ...IMPORT_CENTER_SECTION_META[sectionId],
    cards: getImportCenterCardsBySection(sectionId),
  })).filter((s) => s.cards.length > 0);
}
