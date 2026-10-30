export const LOG_TYPES = [
  {
    id: 'audit',
    label: '人員做了什麼',
    hint: '誰登入、改了資料，或被系統拒絕。',
  },
  {
    id: 'system',
    label: '網站怎麼被呼叫',
    hint: '哪個網址被打開、花了多久、有沒有出錯。',
  },
  {
    id: 'email',
    label: '寄出的信',
    hint: '寄給誰、主旨寫什麼、有沒有寄出去。',
  },
];

export const ACCOUNT_SECURITY_PRESETS = [
  { code: 'login_success', label: '登入成功', group: '帳號進出' },
  { code: 'login_failure', label: '登入失敗', group: '帳號進出' },
  { code: 'access_profile_stale', label: '登入資料過期', group: '帳號進出' },
  { code: 'account_disabled_access_attempt', label: '停用的帳號還想進來', group: '帳號進出' },
  { code: 'permission_denied', label: '權限不夠', group: '帳號進出' },
  { code: 'account_created', label: '建立帳號', group: '帳號異動' },
  { code: 'account_updated', label: '更新帳號', group: '帳號異動' },
  { code: 'account_enabled', label: '啟用帳號', group: '帳號異動' },
  { code: 'account_disabled', label: '停用帳號', group: '帳號異動' },
  { code: 'account_password_reset', label: '重設密碼', group: '帳號異動' },
  { code: 'account_password_changed', label: '自己改了密碼', group: '帳號異動' },
  { code: 'permission_override_changed', label: '改了某人的權限', group: '帳號異動' },
  { code: 'student_login_success', label: '學生登入成功', group: '帳號進出' },
  { code: 'student_login_failed', label: '學生登入失敗', group: '帳號進出' },
  { code: 'student_login_blocked', label: '學生被暫時擋住', group: '帳號進出' },
  { code: 'student_account_registered', label: '學生建立帳號', group: '帳號異動' },
  { code: 'student_password_changed', label: '學生改了密碼', group: '帳號異動' },
  { code: 'student_email_changed', label: '學生改了信箱', group: '帳號異動' },
  { code: 'student_password_reset_completed', label: '學生重設了密碼', group: '帳號異動' },
];

const ROLE_LABELS = {
  admin: '管理員',
  worker: '工作人員',
  teacher: '老師',
  office_staff: '行政職員',
  leader: '英語桌帶班',
  student: '學生',
  speaking_host: '口說題組',
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
      moduleLabel: '怎麼呼叫',
      modulePlaceholder: '讀取填 GET，送出填 POST',
      actionLabel: '網址裡有',
      actionPlaceholder: '例如 /api/reservations',
      actionHelp: '網址裡出現這段字就會找到。',
      operatorLabel: '哪一位使用者',
      operatorPlaceholder: '填使用者編號',
      statusLabel: '網站回了什麼',
      statusPlaceholder: '404 是找不到，500 是伺服器出錯',
      keywordPlaceholder: '網址、網路位址或錯誤說明',
    };
  }
  if (logType === 'email') {
    return {
      moduleLabel: '哪一種信',
      modulePlaceholder: '信的種類名稱',
      actionLabel: '跟什麼有關',
      actionPlaceholder: '例如預約、活動',
      actionHelp: '相關資料的種類裡有這段字就會找到。',
      operatorLabel: '相關資料編號',
      operatorPlaceholder: '填那筆資料的編號',
      statusLabel: '寄出結果',
      keywordPlaceholder: '收件人、主旨或錯誤說明',
    };
  }
  return {
    moduleLabel: '哪個功能',
    modulePlaceholder: '例如 auth（登入）、events（活動）',
    actionLabel: '做了什麼',
    actionPlaceholder: '例如登入失敗，或英文名稱的一部分',
    actionHelp: '沒勾下面的話，名稱裡有這幾個字就會找到。',
    operatorLabel: '哪一位人員',
    operatorPlaceholder: '填人員編號',
    statusLabel: '結果',
    keywordPlaceholder: '說明、對象或錯誤原因',
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
    const raw = current.action.trim();
    const spoken = logType === 'audit' ? actionLabel(raw) : raw;
    const exact = logType === 'audit' && current.actionMatchExact ? '，名稱要完全一樣' : '';
    parts.push(`${copy.actionLabel}：${spoken}${exact}`);
  }
  if (logType === 'system' && current.onlyServerErrors) parts.push('只看伺服器出錯');
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
  if (/^2\d\d$/.test(value)) return `成功（${status}）`;
  if (/^3\d\d$/.test(value)) return `轉到別頁（${status}）`;
  if (/^4\d\d$/.test(value)) return `要求有問題（${status}）`;
  if (/^5\d\d$/.test(value)) return `伺服器出錯（${status}）`;
  return String(status);
}

const MODULE_LABELS = {
  auth: '登入與權限',
  events: '活動',
  reservations: '預約',
  reservation: '預約',
  survey: '問卷',
  surveys: '問卷',
  email: '寄信',
  users: '人員',
  classes: '班級',
  accounts: '帳號',
  class_credit: '課堂加分',
  speaking_check: '口說批改',
};

const ACTION_LABELS = {
  student_login_needs_email: '學生還要驗證信箱',
  student_account_pending: '學生帳號待確認',
  student_password_change_failed: '學生改密碼失敗',
  student_password_reset_failed: '學生重設密碼失敗',
  student_campus_profile_refreshed: '學生更新了學籍',
  student_campus_profile_failed: '學生更新學籍失敗',
  student_password_reset_email: '寄出學生重設密碼信',
  student_allocation_saved: '學生儲存課堂加分',
  response_rated: '批改口說',
};

const ENTITY_LABELS = {
  user: '人員',
  teacher: '老師',
  student: '學生',
  StudentAccount: '學生帳號',
  ClassCreditAllocation: '課堂加分',
  SpeakingCheckResponse: '口說作答',
  event: '活動',
  reservation: '預約',
  survey: '問卷',
  email: '信件',
};

export function moduleLabel(code) {
  if (!code) return '';
  return MODULE_LABELS[code] || String(code);
}

export function entityLabel(type) {
  if (!type) return '';
  return ENTITY_LABELS[type] || String(type);
}

export function actionLabel(code) {
  const hit = ACCOUNT_SECURITY_PRESETS.find((item) => item.code === code);
  if (hit) return hit.label;
  return ACTION_LABELS[code] || code || '—';
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
  const name = entityLabel(type);
  if (!name && (id == null || id === '')) return '';
  if (name && id != null && id !== '') return `${name} #${id}`;
  return name || `#${id}`;
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
  if (!(payload?.systemLogs || []).length) gaps.push('網站呼叫');
  if (!(payload?.auditLogs || []).length) gaps.push('人員操作');
  if (!(payload?.emailLogs || []).length) gaps.push('寄出的信');
  return gaps;
}

function timeValue(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}
