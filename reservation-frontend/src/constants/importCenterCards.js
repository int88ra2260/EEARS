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
 * @property {string[]} impactModules
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

/** @type {ImportCenterCard[]} */
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
    description: '日常行政最常用之資料匯入入口；實際上傳與寫入仍在各功能頁完成。',
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

/** @type {ImportCenterCard[]} */
export const IMPORT_CENTER_CARDS = [
  {
    id: 'lj-enrollment',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '學習歷程名冊匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description:
      '匯入學期追蹤名冊（系所、學院、班別、年級、學號、姓名），供英語學習歷程統計、行政總覽與風險分析使用。',
    impactModules: ['英語學習歷程中心', '分析報表', '行政總覽'],
    riskHint: '名冊為學期維度資料；刪除批次會重新計算總覽統計，建議由管理員操作。',
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
    description:
      '匯入外部英檢成績（多種測驗類型、四技能分數與 CEFR），寫入 Learning Journey V3，供最佳技能與達標統計。',
    impactModules: ['英語學習歷程中心', '分析報表'],
    riskHint: '可選 replace 模式覆蓋衝突資料；匯入後會觸發最佳技能重算，建議由管理員操作。',
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
    description:
      '從 EWL 寫作工坊 API 同步預約與簽到至學習歷程活動參與（EWL），補齊個人歷程與中心報表。',
    impactModules: ['英語學習歷程中心', '分析報表', '行政總覽'],
    riskHint: '以 ConsultationTimeID 去重；日期依活動／預約日篩選。建議先預覽再寫入。',
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
    description:
      '匯入班級 roster（學期、課程名稱、課程代碼、授課老師與學生名單）。支援 Excel 或選課系統修課名單 PDF。',
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
    description:
      '匯入 BESTEP 出席（LR/SW）與成績（聽讀說寫、CEFR），以及團體名次計算；供培力英檢管理與班級 BESTEP 檢視。',
    impactModules: ['培力英檢管理', '班級 BESTEP', '學習歷程投影'],
    riskHint: '僅「報名成功」學生會寫入；請分場次匯入 LR 與 SW 出席資料。',
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
    description:
      '依刷卡機 Excel 比對學號並寫入活動簽到紀錄；入口位於各活動明細的「匯入與匯出」分頁。',
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
    description:
      '跨模組查詢最近匯入、同步與稽核摘要；具權限者可刪除並回滾部分匯入批次（英語學習歷程、BESTEP）。部分舊紀錄僅有稽核摘要，不代表完整明細。',
    impactModules: ['英語學習歷程', '班級', 'BESTEP', '活動', '系統稽核'],
    riskHint: '刪除會回滾可追蹤批次；班級名冊／活動刷卡需新匯入才有 importBatchId；Job／LJ 重建類僅移除紀錄。',
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
    description:
      '查看 operation runs、資料新鮮度摘要；指定學期後可進行資料健康檢查與 projection 重建。',
    impactModules: ['英語學習歷程中心', '資料維運紀錄'],
    riskHint: '重建 projection 會重算四技能最佳成績，請由管理員操作；匯入請至學習歷程匯入頁。',
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
    description:
      '問卷作答與統計資料匯出（JSON／XLSX）；目前後台無問卷 bulk Excel 匯入功能。',
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
    description:
      '獨立的全校學生基本資料（學號、姓名、系所、身份別、Email）bulk 匯入入口。',
    impactModules: ['預約', '學習歷程', '報表'],
    riskHint: '尚無對應匯入流程，請勿假設與名冊匯入相同格式。',
    pendingReason: '專案中未發現獨立學生主檔 Excel 匯入頁；追蹤名冊請使用「學習歷程名冊匯入」。',
  },
  {
    id: 'activity-bulk',
    section: IMPORT_CENTER_SECTION.EXPORT_PENDING,
    title: '活動資料匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.DISABLED,
    hideHistoryButton: true,
    description: '批次匯入活動清單、場次與能力指標對應。',
    impactModules: ['活動與預約'],
    riskHint: '尚無 bulk 匯入；請使用活動列表新增或批次建立。',
    pendingReason: '目前無活動 bulk Excel 匯入頁；活動請於活動列表新增或批次建立。',
  },
  {
    id: 'course-records',
    section: IMPORT_CENTER_SECTION.FREQUENT,
    title: '教務處修課名單匯入',
    kind: 'import',
    statusTier: IMPORT_STATUS_TIER.ENABLED,
    description:
      '匯入每學期教務處提供之修課名單（EAP/ESP/GE），同步寫入學習歷程修課紀錄，並可自動建立班級名冊。',
    impactModules: ['學習歷程', '學生 profile', '事件時間軸', '班級與參與'],
    riskHint: '寫入後會自動重建相關學生的 analytic 衍生層；確認寫入需超級管理員權限。',
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
