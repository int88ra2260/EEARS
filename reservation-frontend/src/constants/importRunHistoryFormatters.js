/**
 * Import Run History（P13）顯示用 formatter
 */
import { hasPermission } from '../utils/accessControl';
import { P } from './permissions';

const IMPORT_TYPE_LABELS = {
  lj_enrollment_import: 'LJ 名冊匯入',
  lj_exam_import: 'LJ 英檢匯入',
  lj_import: 'LJ 匯入',
  lj_operation: 'LJ 維運操作',
  job_sync: 'Job 同步',
  job_reconcile: 'Job 對帳',
  job_governance: 'Job 治理',
  class_roster_import: '班級名冊匯入',
  bestep_attendance_import: 'BESTEP 出席匯入',
  bestep_score_import: 'BESTEP 成績匯入',
  event_card_excel_import: '活動刷卡 Excel',
  unknown_import: '匯入（未分類）',
  import: '匯入（稽核摘要）',
  audit_import: '稽核摘要',
};

const MODULE_LABELS = {
  learning_journey: '英語學習歷程',
  jobs: '背景工作',
  bestep: 'BESTEP',
  classes: '班級',
  operations: '活動／維運',
  events: '活動',
  unknown: '未知',
  audit: '稽核',
  admin_classes: '班級（稽核）',
  reservations: '預約／活動（稽核）',
};

const STATUS_LABELS = {
  success: '成功',
  failed: '失敗',
  partial: '部分成功',
  partial_success: '部分成功',
  running: '執行中',
  skipped: '略過',
  unknown: '未知',
};

const SOURCE_LABELS = {
  lj_import_history: 'LJ 匯入紀錄',
  lj_operation_run: 'LJ 操作紀錄',
  job_run: 'Job 執行',
  audit_log: '稽核摘要',
};

export function formatImportTypeLabel(importType) {
  if (!importType) return '—';
  return IMPORT_TYPE_LABELS[importType] || importType;
}

export function formatModuleLabel(module) {
  if (!module) return '—';
  return MODULE_LABELS[module] || module;
}

export function formatStatusLabel(status) {
  if (!status) return '—';
  const key = String(status).toLowerCase();
  return STATUS_LABELS[key] || status;
}

export function formatSourceLabel(source) {
  if (!source) return '—';
  return SOURCE_LABELS[source] || source;
}

export function getStatusBadgeVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'success') return 'success';
  if (key === 'failed') return 'danger';
  if (key === 'partial' || key === 'partial_success') return 'warning';
  if (key === 'running') return 'info';
  if (key === 'unknown') return 'secondary';
  return 'secondary';
}

export function formatCount(value) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return String(n);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}

export function pickDisplayTime(row) {
  return row?.startedAt || row?.createdAt || row?.finishedAt || null;
}

export const IMPORT_RUN_SOURCE_OPTIONS = [
  { value: '', label: '全部來源' },
  { value: 'lj_import_history', label: formatSourceLabel('lj_import_history') },
  { value: 'lj_operation_run', label: formatSourceLabel('lj_operation_run') },
  { value: 'job_run', label: formatSourceLabel('job_run') },
  { value: 'audit_log', label: formatSourceLabel('audit_log') },
];

export const IMPORT_RUN_TYPE_OPTIONS = [
  { value: '', label: '全部匯入類型' },
  { value: 'lj_enrollment_import', label: formatImportTypeLabel('lj_enrollment_import') },
  { value: 'lj_exam_import', label: formatImportTypeLabel('lj_exam_import') },
  { value: 'lj_operation', label: formatImportTypeLabel('lj_operation') },
  { value: 'job_sync', label: formatImportTypeLabel('job_sync') },
  { value: 'class_roster_import', label: formatImportTypeLabel('class_roster_import') },
  { value: 'bestep_attendance_import', label: formatImportTypeLabel('bestep_attendance_import') },
  { value: 'bestep_score_import', label: formatImportTypeLabel('bestep_score_import') },
  { value: 'event_card_excel_import', label: formatImportTypeLabel('event_card_excel_import') },
];

export const IMPORT_RUN_MODULE_OPTIONS = [
  { value: '', label: '全部模組' },
  { value: 'learning_journey', label: formatModuleLabel('learning_journey') },
  { value: 'jobs', label: formatModuleLabel('jobs') },
  { value: 'bestep', label: formatModuleLabel('bestep') },
  { value: 'classes', label: formatModuleLabel('classes') },
  { value: 'operations', label: formatModuleLabel('operations') },
  { value: 'events', label: formatModuleLabel('events') },
];

export const IMPORT_RUN_STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'success', label: formatStatusLabel('success') },
  { value: 'failed', label: formatStatusLabel('failed') },
  { value: 'partial_success', label: formatStatusLabel('partial_success') },
  { value: 'running', label: formatStatusLabel('running') },
  { value: 'skipped', label: formatStatusLabel('skipped') },
  { value: 'unknown', label: formatStatusLabel('unknown') },
];

function findOptionLabel(options, value, allLabel) {
  if (!value) return allLabel;
  const hit = options.find((o) => o.value === value);
  return hit ? hit.label : value;
}

/**
 * 依已套用篩選產生查詢摘要（P14-3）
 * @param {Record<string, string>} filters
 */
export function buildAppliedFiltersSummary(filters = {}) {
  const source = findOptionLabel(IMPORT_RUN_SOURCE_OPTIONS, filters.source, '全部來源');
  const importType = findOptionLabel(IMPORT_RUN_TYPE_OPTIONS, filters.importType, '全部類型');
  const module = findOptionLabel(IMPORT_RUN_MODULE_OPTIONS, filters.module, '全部模組');
  const status = findOptionLabel(IMPORT_RUN_STATUS_OPTIONS, filters.status, '全部狀態');

  let datePart = '最近紀錄';
  if (filters.dateFrom && filters.dateTo) {
    datePart = `${filters.dateFrom}～${filters.dateTo}`;
  } else if (filters.dateFrom) {
    datePart = `${filters.dateFrom} 起`;
  } else if (filters.dateTo) {
    datePart = `至 ${filters.dateTo}`;
  }

  const keyword = String(filters.keyword || '').trim();
  const parts = [source, importType, module, status, datePart];
  if (keyword) parts.push(`關鍵字「${keyword}」`);
  return parts.join(' / ');
}

/** 列表列：無明細時的 tooltip 說明 */
export function getNoDetailTooltip(row) {
  if (!row) return '此紀錄未提供可查詢之明細';
  if (row.source === 'audit_log') {
    return '此筆來自稽核摘要，僅保留操作紀錄，沒有完整匯入明細';
  }
  return '此紀錄未提供可查詢之明細，請至原功能頁查看';
}

/** 是否具備刪除此列的權限（不含 deletable 旗標） */
export function canDeleteImportRunByPermission(accessProfile, row) {
  if (!accessProfile || !row) return false;
  if (accessProfile.isAdmin || accessProfile.hasAdminRights) {
    if (
      row.source === 'lj_import_history' ||
      row.source === 'lj_operation_run' ||
      row.source === 'job_run'
    ) {
      return true;
    }
    if (row.source === 'audit_log') {
      return (
        row.module === 'bestep' ||
        row.module === 'classes' ||
        row.module === 'admin_classes' ||
        row.module === 'operations' ||
        row.module === 'events' ||
        row.module === 'reservations' ||
        row.importType === 'bestep_attendance_import' ||
        row.importType === 'bestep_score_import' ||
        row.importType === 'class_roster_import' ||
        row.importType === 'event_card_excel_import'
      );
    }
  }
  if (row.source === 'lj_import_history' || row.source === 'lj_operation_run') {
    return hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  }
  if (row.source === 'job_run') {
    return hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  }
  if (
    row.source === 'audit_log' &&
    (row.module === 'bestep' ||
      row.importType === 'bestep_attendance_import' ||
      row.importType === 'bestep_score_import')
  ) {
    return hasPermission(accessProfile, P.CAN_IMPORT_BESTEP);
  }
  if (
    row.source === 'audit_log' &&
    (row.importType === 'class_roster_import' || row.module === 'classes' || row.module === 'admin_classes')
  ) {
    return hasPermission(accessProfile, P.CAN_MANAGE_CLASSES);
  }
  if (
    row.source === 'audit_log' &&
    (row.importType === 'event_card_excel_import' ||
      row.module === 'operations' ||
      row.module === 'events' ||
      row.module === 'reservations')
  ) {
    return (
      hasPermission(accessProfile, P.CAN_CHECKIN_STUDENTS) ||
      hasPermission(accessProfile, P.CAN_MANAGE_EVENTS)
    );
  }
  return false;
}

export function getDeleteDisabledTooltip(row, accessProfile) {
  if (!row) return '無法刪除';
  if (!canDeleteImportRunByPermission(accessProfile, row)) {
    return '您沒有刪除此類匯入紀錄的權限';
  }
  if (!row.deletable) {
    return row.deleteDisabledReason || '此紀錄不支援刪除';
  }
  return null;
}

export function buildDeleteImportRunConfirmMessage(row) {
  const typeLabel = formatImportTypeLabel(row?.importType);
  const file = row?.fileName || '—';
  const recordOnly =
    row?.source === 'job_run' ||
    row?.importType === 'job_sync' ||
    row?.importType === 'job_reconcile' ||
    row?.importType === 'job_governance' ||
    (row?.rawSource?.operationType &&
      ['REBUILD_BEST_SKILL_PROJECTION', 'REBUILD_ANALYTICS', 'HEALTH_CHECK'].includes(
        row.rawSource.operationType,
      ));
  if (recordOnly) {
    return `此操作僅會移除這筆執行紀錄，不會還原背景同步產生的資料。\n類型：${typeLabel}\n是否繼續？`;
  }
  if (row?.source === 'lj_import_history' || row?.source === 'lj_operation_run') {
    if (row.importType === 'lj_exam_import') {
      return `此操作會刪除此批考試匯入資料，並重新計算該學期學生最佳成績。\n類型：${typeLabel}\n檔名：${file}\n是否繼續？`;
    }
    return `此操作會刪除此批名冊匯入資料。\n類型：${typeLabel}\n檔名：${file}\n是否繼續？`;
  }
  if (row?.module === 'bestep') {
    return `此操作會刪除此批 BESTEP 匯入寫入的資料，並移除對應稽核紀錄。\n類型：${typeLabel}\n檔名：${file}\n是否繼續？`;
  }
  if (row?.importType === 'class_roster_import') {
    return `此操作會還原此次班級名冊匯入：新增成員將刪除、更新成員將還原為匯入前狀態。\n類型：${typeLabel}\n是否繼續？`;
  }
  if (row?.importType === 'event_card_excel_import') {
    return `此操作會還原此次刷卡匯入寫入的簽到狀態。\n類型：${typeLabel}\n是否繼續？`;
  }
  return `確定要刪除此筆匯入紀錄及其寫入的資料嗎？\n類型：${typeLabel}\n檔名：${file}`;
}
