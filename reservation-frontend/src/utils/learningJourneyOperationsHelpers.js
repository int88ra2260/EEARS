export const OPERATION_TYPES = [
  { value: '', label: '全部操作' },
  { value: 'IMPORT_ENROLLMENT', label: '名冊匯入' },
  { value: 'IMPORT_EXAM', label: '英檢匯入' },
  { value: 'IMPORT_ENROLLMENT,IMPORT_EXAM', label: '所有匯入' },
  { value: 'REBUILD_BEST_SKILL_PROJECTION', label: 'Projection 重建' },
];

export const STATUSES = [
  { value: '', label: '全部狀態' },
  { value: 'running', label: '執行中' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失敗' },
  { value: 'partial', label: '部分成功' },
];

export const DEFAULT_LIMIT = 20;

export function defaultCleanupOlderThan() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function formatDateZhTw(value) {
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

export function operationTypeLabel(type) {
  if (type === 'IMPORT_ENROLLMENT') return '名冊匯入';
  if (type === 'IMPORT_EXAM') return '英檢匯入';
  if (type === 'REBUILD_BEST_SKILL_PROJECTION') return 'Projection 重建';
  if (type === 'HEALTH_CHECK') return '健康檢查';
  return type || '—';
}

export function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'running') return '執行中';
  if (s === 'success') return '成功';
  if (s === 'failed') return '失敗';
  if (s === 'partial') return '部分成功';
  return status || '—';
}

export function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'text-bg-success';
  if (s === 'failed') return 'text-bg-danger';
  if (s === 'partial') return 'text-bg-warning';
  if (s === 'running') return 'text-bg-info';
  return 'text-bg-secondary';
}

export function durationLabel(ms) {
  if (ms == null || ms === '') return '—';
  return `${Number(ms || 0)} ms`;
}

export function parseLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(n), 5), 100);
}

export function parseOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(Math.floor(n), 0);
}

export function isEmptyJson(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function yyyymmdd(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

export function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildOperationRunsCsv(rows) {
  const headers = [
    'operationType',
    'semesterId',
    'status',
    'executedByUsername',
    'startedAt',
    'finishedAt',
    'durationMs',
    'requestId',
    'warningsCount',
    'errorCode',
    'errorMessage',
    'archivedAt',
    'archivedByUsername',
    'cleanupRequestId',
  ];
  const lines = rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','));
  return [headers.join(','), ...lines].join('\r\n');
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getRemediationHints(detail) {
  if (!detail) return [];
  const type = detail.operationType;
  const status = String(detail.status || '').toLowerCase();
  const hasWarnings = Array.isArray(detail.warnings) && detail.warnings.length > 0;
  const hints = [];

  if (status === 'failed' && type === 'IMPORT_ENROLLMENT') {
    hints.push('檢查 Excel 欄位格式。');
    hints.push('檢查 semesterId 是否正確。');
    hints.push('檢查學生 ID 欄位是否存在且格式一致。');
    hints.push('使用 requestId 對應後端 log。');
  } else if (status === 'failed' && type === 'IMPORT_EXAM') {
    hints.push('檢查考試類型是否支援。');
    hints.push('檢查分數欄位是否為可解析數值。');
    hints.push('檢查 CEFR mapping 是否已有該測驗版本。');
    hints.push('使用 requestId 對應後端 log。');
  } else if (status === 'failed' && type === 'REBUILD_BEST_SKILL_PROJECTION') {
    hints.push('先檢查 Data Health 的 EXAM_ATTEMPTS。');
    hints.push('確認 et_exam_attempt_skill_scores 有資料。');
    hints.push('確認 enrollment snapshot 存在。');
    hints.push('使用 requestId 對應後端 log。');
  }

  if (status === 'partial' || hasWarnings) {
    hints.push('展開 warnings 檢查個別警示。');
    hints.push('若 fallback 使用率高，檢查 activity_participations 是否已匯入或同步。');
    hints.push('若 projection 覆蓋不足，執行 rebuild 或檢查 exam attempts。');
    hints.push('若顯示 Import Histories fallback，確認 P5.5 operation runs 是否正常寫入。');
  }
  return hints;
}

export function latestFinishedRun(rows, predicate) {
  return rows
    .filter((row) => predicate(row) && row.finishedAt)
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())[0] || null;
}

export function latestStartedRun(rows, predicate) {
  return rows
    .filter((row) => predicate(row) && (row.startedAt || row.finishedAt))
    .sort((a, b) => new Date(b.startedAt || b.finishedAt).getTime() - new Date(a.startedAt || a.finishedAt).getTime())[0] || null;
}

export function latestImportHistoryAt(rows, type) {
  const timestamps = rows
    .filter((row) => row.importType === type || row.type === type)
    .map((row) => row.importedAt || row.createdAt)
    .map((value) => {
      const time = value ? new Date(value).getTime() : NaN;
      return Number.isFinite(time) ? time : null;
    })
    .filter((time) => time != null);
  if (!timestamps.length) return '';
  return new Date(Math.max(...timestamps)).toISOString();
}
