/**
 * 資料匯入中心 — 統一狀態標籤（P11-5）
 * 僅四種對外文案：已啟用、僅匯出、尚未啟用、待確認
 */

/** @typedef {'enabled' | 'export_only' | 'disabled' | 'pending'} ImportStatusTier */
/** @typedef {'import' | 'export' | 'sync'} ImportCenterKind */

export const IMPORT_STATUS_TIER = {
  ENABLED: 'enabled',
  EXPORT_ONLY: 'export_only',
  DISABLED: 'disabled',
  PENDING: 'pending',
};

/** @type {Record<ImportStatusTier, string>} */
export const IMPORT_STATUS_LABEL = {
  enabled: '已啟用',
  export_only: '僅匯出',
  disabled: '尚未啟用',
  pending: '待確認',
};

/** @type {Record<ImportStatusTier, { bg: string, textClass?: string }>} */
export const IMPORT_STATUS_BADGE = {
  enabled: { bg: 'success' },
  export_only: { bg: 'primary' },
  disabled: { bg: 'secondary' },
  pending: { bg: 'warning', textClass: 'text-dark' },
};

/** @type {Record<ImportCenterKind, string>} */
export const IMPORT_KIND_LABEL = {
  import: '匯入',
  export: '匯出',
  sync: '同步',
};

/** @type {Record<ImportCenterKind, string>} */
export const IMPORT_KIND_CLASS = {
  import: 'import-center-kind--import',
  export: 'import-center-kind--export',
  sync: 'import-center-kind--sync',
};

/**
 * @param {ImportStatusTier} statusTier
 */
export function isImportCenterActionable(statusTier) {
  return statusTier === IMPORT_STATUS_TIER.ENABLED || statusTier === IMPORT_STATUS_TIER.EXPORT_ONLY;
}

/**
 * @param {ImportCenterKind} kind
 * @param {ImportStatusTier} statusTier
 */
export function getPrimaryActionLabel(kind, statusTier) {
  if (statusTier === IMPORT_STATUS_TIER.PENDING) return '待確認';
  if (statusTier === IMPORT_STATUS_TIER.DISABLED) return '尚未啟用';
  if (statusTier === IMPORT_STATUS_TIER.EXPORT_ONLY || kind === 'export') return '前往匯出';
  if (kind === 'sync') return '前往查看';
  return '前往匯入';
}
