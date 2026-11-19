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
 * @property {string} [nextHint] - 覆蓋卡片底部的下一步提示
 * @property {string} [pendingReason]
 * @property {import('./importCenterCards').ImportCenterSectionId} [section]
 * @property {boolean} [hideHistoryButton] - 隱藏「查看匯入紀錄」按鈕（無對應行為時）
 */

/** @typedef {typeof IMPORT_CENTER_SECTION[keyof typeof IMPORT_CENTER_SECTION]} ImportCenterSectionId */

/** 卡片分區（P14-2 UI） */
export const IMPORT_CENTER_SECTION = {
  FREQUENT: 'frequent',
  EXCEPTION: 'exception',
  OPS: 'ops',
  EXPORT_PENDING: 'export_pending',
};

/** @type {Record<string, { id: string, title: string, description: string }>} */
export const IMPORT_CENTER_SECTION_META = {
  [IMPORT_CENTER_SECTION.FREQUENT]: {
    id: IMPORT_CENTER_SECTION.FREQUENT,
    title: '常用路徑',
    description: '依任務選入口。本頁不直接收檔；對照「匯入什麼」與「會影響什麼」後再到原頁上傳。',
  },
  [IMPORT_CENTER_SECTION.EXCEPTION]: {
    id: IMPORT_CENTER_SECTION.EXCEPTION,
    title: '例外補丁',
    description: '日常請走上方主路徑。這裡只在無法用修課名單批次建班時，才手動補單一班級。',
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
    goal: '準備某學期 KPI／成效分母（例如 115-1）',
    steps: [
      '先匯「學期在學名冊」→ 決定該學期在學分母',
      '培力成績走「培力英檢匯入」；校外英檢走「校外英檢成績」',
      '到「學習成效分析 → KPI 報表／概況」選同學期查看',
    ],
  },
  {
    id: 'course-class',
    goal: '更新修課與班級名單',
    steps: [
      '優先匯「教務處修課名單」，並勾選同步班級',
      '只有無法批次建班時，才用下方「班級名冊（例外補丁）」',
    ],
  },
  {
    id: 'which-roster',
    goal: '三種「名單」怎麼選',
    steps: [
      '學期在學名冊＝KPI／成效分母（依學期）',
      '報名核對名單＝培力報名核對學號／身分證（不依學期累積）',
      '班級修課名冊＝單班教學名單（日常請由修課名單同步）',
    ],
  },
  {
    id: 'bestep',
    goal: '更新培力英檢出席／成績',
    steps: [
      '只用「培力英檢（BESTEP）資料匯入」：出席聽讀、說寫各一次，成績一次',
      '不要再到「校外英檢成績」重傳培力；寫入後會自動同步到學習歷程',
    ],
  },
];
/** @type {ImportCenterCard[]} */
export const IMPORT_CENTER_CARDS = [
  {
    id: 'lj-enrollment',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '學期在學名冊',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '某學期「算進分母的人」。B2 KPI 與成效概況「尚無英檢」都以這份為母體。',
    dataToImport: '學期在學名冊 Excel（系所、學院、班別、年級、學號、姓名）。匯入時請選對學期（如 115-1）。',
    affects: [
      'B2／學習成效 KPI 報表的分母人數',
      '成效概況「各入學年度尚無英檢」的分母',
      '英語學習歷程總覽、風險分析的涵蓋學生',
    ],
    notFor: '不是單班名單，也不是「報名核對名單」。',
    impactModules: ['英語學習歷程中心', 'KPI 報表', '成效分析概況'],
    riskHint: '名冊為學期維度；刪除批次會重算總覽統計，建議由管理員操作。',
    routeAccess: '/admin/learning-journey/import',
    importPath: '/admin/learning-journey/import',
    historyPath: '/admin/learning-journey/import',
    templateOnTarget: true,
    templateNote: '於學習歷程匯入頁下載學期在學名冊範例',
  },
  {
    id: 'lj-exam',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '校外英檢成績',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '匯入多益、雅思等校外英檢成績（四技能與 CEFR），供達標與最佳技能統計。',
    dataToImport: '校外英檢成績 Excel（測驗類型、四技能分數、CEFR、測驗日期等）。培力成績不要從這裡再傳。',
    affects: [
      'B2／學習成效 KPI 的達標人數（分子）',
      '學生個人學習歷程的最佳技能與考試紀錄',
      '分析報表中的英檢相關指標',
    ],
    notFor: '不算學期人口。培力成績請走「培力英檢匯入」；此處若填 BESTEP 會被拒收。',
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
    id: 'english-test-roster',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '報名核對名單',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    hideHistoryButton: true,
    description: '培力報名用：核對學號、姓名、身分證。新檔覆蓋上一份，不累積學期。',
    dataToImport: '報名核對名單 Excel（學號、姓名、身分證等）。不需選學期。',
    affects: ['培力英檢報名時的身分比對結果'],
    notFor: '不是「學期在學名冊」，也不是單班名單。KPI 分母請用學期在學名冊。',
    impactModules: ['培力英檢報名'],
    riskHint: '新檔會覆蓋目前比對用的名單，不會保留多學期版本。',
    routeAccess: '/admin/english-test',
    importPath: '/admin/english-test?tab=roster',
    nextHint: '下一步：前往培力英檢管理的「報名核對名單」分頁上傳',
    templateOnTarget: true,
    templateNote: '於「報名核對名單」分頁可下載範例',
    importNote: '需具備培力英檢管理權限。此名單只服務報名核對。',
  },
  {
    id: 'bestep',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '培力英檢（BESTEP）匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    hideHistoryButton: true,
    description: '匯入培力出席與成績。成績寫入後會自動同步到學習歷程，不必再匯「校外英檢成績」。',
    dataToImport: '出席 Excel 聽讀（LR）、說寫（SW）各傳一次，並另選考試日期；成績 Excel 傳一次（聽讀說寫、CEFR）。僅「報名成功」學生會寫入。',
    affects: [
      '培力英檢管理與班級 BESTEP 檢視',
      '學習歷程考試紀錄與學習成效分析（成績匯入後自動同步）',
    ],
    notFor: '不是學期人口，也不是校外英檢。多益、雅思等請用「校外英檢成績」。',
    impactModules: ['培力英檢管理', '班級 BESTEP', '學習歷程投影', '學習成效分析'],
    riskHint:
      '成績匯入後請稍候再查學習分析頁。若需補寫舊學期，可執行 npm run lj:promote-bestep。',
    routeAccess: '/admin/english-test/import',
    importPath: '/admin/english-test/import',
    templateOnTarget: true,
    templateNote: '於匯入頁可下載成績與出席範例；匯入失敗時可下載錯誤報表',
  },
  {
    id: 'class-roster',
    section: IMPORT_CENTER_SECTION.EXCEPTION,
    title: '班級名冊（例外補丁）',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '只補單一班級。日常請先用「教務處修課名單」並勾選同步班級。',
    dataToImport: '班級 roster Excel，或選課系統修課名單 PDF（含學期、課程、教師、學生）。',
    affects: [
      '該班級的學生名單與參與統計',
      '教學儀表板／班級總覽顯示',
    ],
    notFor: '不是學期在學名冊，也不是報名核對名單。能批次建班時不要用這裡。',
    impactModules: ['班級與參與', '教學儀表板'],
    riskHint: '匯入會寫入該班級名單；請確認學期與班級名稱正確。',
    routeAccess: '/admin/classes',
    importPath: '/admin/classes',
    hideHistoryButton: true,
    templateOnTarget: true,
    templateNote: '於班級列表頁「匯入名單」可下載 API 範本',
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
    dataToImport: '尚未開放。學期分母請用「學期在學名冊」；培力報名比對請用「報名核對名單」。',
    affects: ['規劃影響預約、學習歷程與報表；目前尚未寫入任何資料'],
    notFor: '不是學期在學名冊，也不是報名核對名單。',
    impactModules: ['預約', '學習歷程', '報表'],
    riskHint: '尚無對應匯入流程。',
    pendingReason: '尚無全校學生主檔匯入頁。學期分母用「學期在學名冊」；報名比對用「報名核對名單」。',
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
    title: '教務處修課名單',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description: '主路徑：匯入 EAP／ESP／GE 修課名單，寫入歷程修課紀錄，並預設同步班級。',
    dataToImport: '教務處原始修課名單 Excel（多工作表）。建議先預覽再確認寫入。',
    affects: [
      '學生學習歷程的修課紀錄與事件時間軸',
      '自動建立／更新班級修課名冊',
      '相關學生的 analytic 衍生層重建',
    ],
    notFor: '不是學期在學名冊。KPI 分母請用「學期在學名冊」。已勾同步班級時，不必再匯班級例外補丁。',
    impactModules: ['學習歷程', '學生 profile', '事件時間軸', '班級與參與'],
    riskHint: '確認寫入需超級管理員權限；寫入後會重建相關學生 analytic。',
    routeAccess: '/admin/learning-journey/import',
    importPath: '/admin/learning-journey/import',
    templateOnTarget: false,
    templateNote: '使用教務處原始修課名單 Excel（多工作表）',
    importNote: '建議先「預覽匯入」，確認無誤後再「確認寫入」。同步班級預設開啟。',
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
  IMPORT_CENTER_SECTION.EXCEPTION,
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
