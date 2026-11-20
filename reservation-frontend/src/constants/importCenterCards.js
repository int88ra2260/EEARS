/**
 * 資料匯入中心：只列系統實際仍在用的匯入／同步入口。
 * 不收尚未開放、僅匯出、或已無頁面的項目。
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
 * @property {string} [statusDetail]
 * @property {string} description
 * @property {string} dataToImport
 * @property {string[]} affects
 * @property {string} [notFor]
 * @property {string[]} impactModules
 * @property {string} riskHint
 * @property {string} [routeAccess]
 * @property {string} [importPath]
 * @property {string} [historyPath]
 * @property {boolean} [templateOnTarget]
 * @property {string} [templateNote]
 * @property {string} [importNote]
 * @property {string} [nextHint]
 * @property {string} [pendingReason]
 * @property {ImportCenterSectionId} [section]
 * @property {boolean} [hideHistoryButton]
 */

/** @typedef {typeof IMPORT_CENTER_SECTION[keyof typeof IMPORT_CENTER_SECTION]} ImportCenterSectionId */

export const IMPORT_CENTER_SECTION = {
  EXCEPTION: 'exception',
  OPS: 'ops',
};

/** @type {Record<string, { id: string, title: string, description: string }>} */
export const IMPORT_CENTER_SECTION_META = {
  [IMPORT_CENTER_SECTION.EXCEPTION]: {
    id: IMPORT_CENTER_SECTION.EXCEPTION,
    title: '例外補丁',
    description: '日常請走「學習歷程資料」匯入修課並同步班級。這裡只在無法批次建班時使用。',
  },
  [IMPORT_CENTER_SECTION.OPS]: {
    id: IMPORT_CENTER_SECTION.OPS,
    title: '維運',
    description: '健康檢查與 projection；匯入紀錄請用頁首橫幅。',
  },
};

/**
 * 首屏任務入口（實際可操作路徑）。
 * @type {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   includes: string[],
 *   routeAccess: string,
 *   primaryPath: string,
 *   primaryLabel: string,
 *   secondaryLinks?: { label: string, path: string, routeAccess?: string }[],
 * }[]}
 */
export const IMPORT_CENTER_PRIMARY_HUBS = [
  {
    id: 'lj-data',
    title: '學習歷程資料',
    description: 'KPI 分母、校外英檢、修課與學測 baseline，都在同一個匯入頁完成。',
    includes: ['學期在學名冊', '校外英檢成績', '教務修課名單', '學測 baseline'],
    routeAccess: '/admin/learning-journey/import',
    primaryPath: '/admin/learning-journey/import',
    primaryLabel: '前往學習歷程匯入',
  },
  {
    id: 'bestep-hub',
    title: '培力英檢',
    description: '出席與成績走培力匯入；身分核對用報名核對名單（不是學期在學名冊）。',
    includes: ['培力出席／成績', '報名核對名單'],
    routeAccess: '/admin/english-test/import',
    primaryPath: '/admin/english-test/import',
    primaryLabel: '前往培力成績匯入',
    secondaryLinks: [
      {
        label: '報名核對名單',
        path: '/admin/english-test?tab=roster',
        routeAccess: '/admin/english-test',
      },
    ],
  },
  {
    id: 'event-checkin',
    title: '活動刷卡簽到',
    description: '請先開活動明細，再上傳刷卡機 Excel。',
    includes: ['活動簽到'],
    routeAccess: '/admin/operations',
    primaryPath: '/admin/operations',
    primaryLabel: '前往活動列表',
  },
  {
    id: 'ewl',
    title: 'EWL 寫作工坊同步',
    description: '從 API 同步預約與簽到到學習歷程，無需 Excel。',
    includes: ['EWL 預約／簽到'],
    routeAccess: '/admin/learning-journey/ewl-sync',
    primaryPath: '/admin/learning-journey/ewl-sync',
    primaryLabel: '前往 EWL 同步',
  },
];

/** 三種名冊怎麼選（文案對照，非獨立匯入頁） */
export const IMPORT_CENTER_ROSTER_GUIDE = {
  id: 'which-roster',
  steps: [
    '學期在學名冊＝KPI／成效分母（依學期；在「學習歷程資料」匯入）',
    '報名核對名單＝培力報名核對學號／身分證（不依學期累積）',
    '班級修課名冊＝單班教學名單（日常由修課名單同步；例外才手動補）',
  ],
};

/** @deprecated 改用 IMPORT_CENTER_ROSTER_GUIDE */
export const IMPORT_CENTER_TASK_GUIDES = [
  {
    id: IMPORT_CENTER_ROSTER_GUIDE.id,
    goal: '三種「名單」怎麼選',
    steps: IMPORT_CENTER_ROSTER_GUIDE.steps,
  },
];

/**
 * 收合區：僅仍存在、且不適合放進首屏 hub 的入口。
 * @type {ImportCenterCard[]}
 */
export const IMPORT_CENTER_CARDS = [
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
];

const MORE_SECTION_ORDER = [
  IMPORT_CENTER_SECTION.EXCEPTION,
  IMPORT_CENTER_SECTION.OPS,
];

/** @param {ImportCenterSectionId} sectionId */
export function getImportCenterCardsBySection(sectionId) {
  return IMPORT_CENTER_CARDS.filter((c) => c.section === sectionId);
}

export function getImportCenterMoreSections() {
  return MORE_SECTION_ORDER.map((sectionId) => ({
    ...IMPORT_CENTER_SECTION_META[sectionId],
    cards: getImportCenterCardsBySection(sectionId),
  })).filter((s) => s.cards.length > 0);
}

/** @deprecated 同 getImportCenterMoreSections */
export function getImportCenterSections() {
  return getImportCenterMoreSections();
}

export function getUsableImportCenterCards() {
  return IMPORT_CENTER_CARDS.filter((c) => c.statusTier === IMPORT_STATUS_TIER.ENABLED);
}

export function getPlannedImportCenterCards() {
  return [];
}

/** @param {ImportStatusTier} tier */
export function filterCardsByStatusTier(tier) {
  return IMPORT_CENTER_CARDS.filter((c) => c.statusTier === tier);
}
