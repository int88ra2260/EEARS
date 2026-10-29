export const LOG_TYPES = [
  {
    id: 'audit',
    label: '操作紀錄',
    hint: '誰對哪個對象做了什麼，以及這次操作是成功還是失敗。',
  },
  {
    id: 'system',
    label: '系統請求',
    hint: '每一次 HTTP 呼叫的路徑、狀態碼、耗時與來源。',
  },
  {
    id: 'email',
    label: '寄信紀錄',
    hint: '郵件範本、收件人、關聯對象與寄送結果。',
  },
];

export const ACCOUNT_SECURITY_PRESETS = [
  { code: 'login_success', label: '登入成功' },
  { code: 'login_failure', label: '登入失敗' },
  { code: 'access_profile_stale', label: '權限資料過期' },
  { code: 'account_disabled_access_attempt', label: '停用帳號仍嘗試進入' },
  { code: 'permission_denied', label: '權限不足' },
  { code: 'account_created', label: '建立帳號' },
  { code: 'account_updated', label: '更新帳號' },
  { code: 'account_enabled', label: '啟用帳號' },
  { code: 'account_disabled', label: '停用帳號' },
  { code: 'account_password_reset', label: '重設密碼' },
  { code: 'account_password_changed', label: '變更密碼' },
  { code: 'permission_override_changed', label: '調整個別權限' },
];

const ROLE_LABELS = {
  admin: '管理員',
  worker: '工作人員',
  teacher: '老師',
  office_staff: '行政職員',
  leader: '英語桌帶班',
  student: '學生',
};

const FILTER_KEYS = [
  'moduleName',
  'action',
  'actionMatchExact',
  'status',
  'keyword',
  'operatorId',
  'dateFrom',
  'dateTo',
  'onlyServerErrors',
];

export function createLogFilters(partial = {}) {
  return {
    moduleName: '',
    action: '',
    actionMatchExact: false,
    status: '',
    keyword: '',
    operatorId: '',
    dateFrom: '',
    dateTo: '',
    onlyServerErrors: false,
    ...partial,
  };
}

export function filtersEqual(a, b) {
  const left = createLogFilters(a);
  const right = createLogFilters(b);
  return FILTER_KEYS.every((key) => left[key] === right[key]);
}

export function filterFieldCopy(logType) {
  if (logType === 'system') {
    return {
      moduleLabel: 'HTTP 方法',
      modulePlaceholder: '包含即可，例如 GET',
      actionLabel: '路徑',
      actionPlaceholder: '例如 /api/reservations',
      actionHelp: '比對路徑是否包含這段文字。',
      operatorLabel: '使用者 ID',
      operatorPlaceholder: 'userId',
      statusLabel: 'HTTP 狀態碼',
      statusPlaceholder: '例如 404',
      keywordPlaceholder: '路徑、IP、瀏覽器或錯誤訊息',
    };
  }
  if (logType === 'email') {
    return {
      moduleLabel: '郵件範本',
      modulePlaceholder: '範本名稱，包含即可',
      actionLabel: '關聯類型',
      actionPlaceholder: '例如 reservation',
      actionHelp: '比對關聯類型是否包含這段文字。',
      operatorLabel: '關聯 ID',
      operatorPlaceholder: 'relatedEntityId',
      statusLabel: '寄送狀態',
      keywordPlaceholder: '收件人、主旨、範本或錯誤訊息',
    };
  }
  return {
    moduleLabel: '模組',
    modulePlaceholder: '完全符合，例如 auth',
    actionLabel: '操作',
    actionPlaceholder: '例如 login_failure',
    actionHelp: '未勾選完全符合時，會找出名稱包含這段文字的操作。',
    operatorLabel: '操作者 ID',
    operatorPlaceholder: 'userId',
    statusLabel: '結果',
    keywordPlaceholder: '摘要、對象 ID 或錯誤訊息',
  };
}

function compact(params) {
  const out = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') out[key] = value;
  });
  return out;
}

export function buildListParams(logType, filters, page, limit) {
  const current = createLogFilters(filters);
  const params = {
    page,
    limit,
    keyword: current.keyword.trim() || undefined,
    dateFrom: current.dateFrom || undefined,
    dateTo: current.dateTo || undefined,
    operatorId: current.operatorId.trim() || undefined,
    module: current.moduleName.trim() || undefined,
    action: current.action.trim() || undefined,
  };

  if (logType === 'system' && current.onlyServerErrors) {
    params.statusMin = 500;
    params.statusMax = 599;
  } else if (current.status.trim()) {
    params.status = current.status.trim();
  }

  if (logType === 'audit' && current.action.trim() && current.actionMatchExact) {
    params.actionMode = 'exact';
  }

  return compact(params);
}

export function describeAppliedFilters(logType, filters) {
  const current = createLogFilters(filters);
  const copy = filterFieldCopy(logType);
  const parts = [];
  if (current.keyword.trim()) parts.push(`關鍵字「${current.keyword.trim()}」`);
  if (current.moduleName.trim()) parts.push(`${copy.moduleLabel}「${current.moduleName.trim()}」`);
  if (current.action.trim()) {
    const exact = logType === 'audit' && current.actionMatchExact ? '（完全符合）' : '';
    parts.push(`${copy.actionLabel}「${current.action.trim()}」${exact}`);
  }
  if (logType === 'system' && current.onlyServerErrors) parts.push('只看 5xx');
  else if (current.status.trim()) parts.push(`${copy.statusLabel}「${statusLabel(current.status)}」`);
  if (current.operatorId.trim()) parts.push(`${copy.operatorLabel} ${current.operatorId.trim()}`);
  if (current.dateFrom || current.dateTo) {
    parts.push(`${current.dateFrom || '不限'} 至 ${current.dateTo || '不限'}`);
  }
  return parts;
}

export function statusTone(status) {
  const value = String(status ?? '').trim().toLowerCase();
  if (!value) return 'muted';
  if (['success', 'ok', 'sent', 'delivered'].includes(value) || /^2\d\d$/.test(value)) return 'ok';
  if (['retry', 'pending', 'queued'].includes(value) || /^3\d\d$/.test(value) || /^4\d\d$/.test(value)) {
    return 'warn';
  }
  if (['failed', 'failure', 'error'].includes(value) || /^5\d\d$/.test(value)) return 'bad';
  return 'muted';
}

export function statusLabel(status) {
  const value = String(status ?? '').trim().toLowerCase();
  if (!value) return '—';
  if (value === 'success' || value === 'ok' || value === 'sent' || value === 'delivered') return '成功';
  if (value === 'failed' || value === 'failure' || value === 'error') return '失敗';
  if (value === 'retry') return '重試';
  if (value === 'pending' || value === 'queued') return '等待';
  return String(status);
}

export function actionLabel(code) {
  const hit = ACCOUNT_SECURITY_PRESETS.find((item) => item.code === code);
  return hit ? hit.label : (code || '—');
}

export function roleLabel(role) {
  if (!role) return '';
  return ROLE_LABELS[role] || String(role);
}

export function formatPerson(name, role, id) {
  const roleText = roleLabel(role);
  const idText = id == null || id === '' ? '' : `#${id}`;
  const head = [name, roleText].filter(Boolean).join(' · ');
  if (!head && !idText) return '—';
  if (!head) return idText;
  if (!idText) return head;
  return `${head} ${idText}`;
}

export function formatEntity(type, id) {
  if (!type && (id == null || id === '')) return '';
  if (type && id != null && id !== '') return `${type} #${id}`;
  return type || `#${id}`;
}

export function formatRelated(type, id) {
  return formatEntity(type, id) || '沒有關聯對象';
}

export function shortRequestId(id) {
  const value = String(id || '');
  if (!value) return '';
  if (value.length <= 14) return value;
  return `${value.slice(0, 4)}…${value.slice(-6)}`;
}

export function formatLogTime(iso, now = new Date()) {
  if (!iso) return { clock: '—', relative: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { clock: '—', relative: '' };
  const clock = new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  const delta = date.getTime() - now.getTime();
  const abs = Math.abs(delta);
  const suffix = delta > 0 ? '後' : '前';
  let relative = '剛剛';
  if (abs >= 86400000) relative = `${Math.floor(abs / 86400000)} 天${suffix}`;
  else if (abs >= 3600000) relative = `${Math.floor(abs / 3600000)} 小時${suffix}`;
  else if (abs >= 60000) relative = `${Math.floor(abs / 60000)} 分鐘${suffix}`;
  return { clock, relative };
}

export function formatDuration(ms) {
  if (ms == null || ms === '') return '—';
  const value = Number(ms);
  if (!Number.isFinite(value)) return '—';
  if (value < 1000) return `${Math.round(value)} 毫秒`;
  const seconds = value / 1000;
  return `${seconds >= 10 ? Math.round(seconds) : seconds.toFixed(1)} 秒`;
}

export function durationTone(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return 'muted';
  if (value >= 3000) return 'bad';
  if (value >= 1000) return 'warn';
  return 'muted';
}

export function methodTone(method) {
  const value = String(method || '').toUpperCase();
  if (value === 'GET' || value === 'HEAD') return 'ok';
  if (value === 'POST') return 'info';
  if (value === 'PUT' || value === 'PATCH') return 'warn';
  if (value === 'DELETE') return 'bad';
  return 'muted';
}

export function taipeiDateInputValue(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function addDaysToDateInput(dateStr, days) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  const nextYear = utc.getUTCFullYear();
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(utc.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function pageRangeLabel(page, limit, total) {
  const count = Number(total) || 0;
  if (!count) return '沒有紀錄';
  const start = (Math.max(page, 1) - 1) * limit + 1;
  const end = Math.min(page * limit, count);
  return `第 ${start.toLocaleString('zh-TW')}–${end.toLocaleString('zh-TW')} 筆，共 ${count.toLocaleString('zh-TW')} 筆`;
}

export function pageWindow(current, total) {
  const pages = [];
  const page = Math.max(1, current || 1);
  const last = Math.max(1, total || 1);
  const start = Math.max(1, page - 2);
  const end = Math.min(last, page + 2);
  if (start > 1) pages.push(1);
  if (start > 2) pages.push('gap-start');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < last - 1) pages.push('gap-end');
  if (end < last) pages.push(last);
  return pages;
}

export function formatChangedFields(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  }
  if (typeof value === 'object') return Object.keys(value);
  return [String(value)];
}

export function buildRequestTimeline(payload) {
  const items = [];
  (payload?.systemLogs || []).forEach((row) => {
    items.push({ kind: 'http', id: `http-${row.id}`, at: row.createdAt, row });
  });
  (payload?.auditLogs || []).forEach((row) => {
    items.push({ kind: 'audit', id: `audit-${row.id}`, at: row.createdAt, row });
  });
  (payload?.emailLogs || []).forEach((row) => {
    items.push({ kind: 'email', id: `email-${row.id}`, at: row.createdAt, row });
  });
  items.sort((a, b) => timeValue(a.at) - timeValue(b.at));
  return items;
}

export function requestGapLabels(payload) {
  const gaps = [];
  if (!(payload?.systemLogs || []).length) gaps.push('系統請求');
  if (!(payload?.auditLogs || []).length) gaps.push('操作紀錄');
  if (!(payload?.emailLogs || []).length) gaps.push('寄信紀錄');
  return gaps;
}

function timeValue(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}
