import {
  STAFF_LEVEL_OPTIONS,
  STAFF_LEVEL_TABLE_LABEL,
  STATUS_FILTER_OPTIONS,
  TEACHER_LEVEL_OPTIONS,
  TEACHER_LEVEL_TABLE_LABEL,
} from '../constants/accountManagement';
import { SYSTEM_ONLY_ASSIGNMENT_KEYS, pickPermissionLabel } from '../constants/permissionGroups';
import { ALL_SCOPES } from '../constants/scopes';

const ROLE_LABELS = {
  admin: '系統管理員',
  teacher: '老師',
  office_staff: '行政職員',
  leader: 'ET Leader',
  worker: '工讀生',
};

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function labelFromOptions(options, value, fallback = value) {
  return options.find((opt) => opt.value === value)?.label || fallback || '';
}

function normalizeScopeList(scopes) {
  if (!Array.isArray(scopes)) return [];
  const allowed = new Set(ALL_SCOPES);
  return Array.from(new Set(scopes.filter((scope) => allowed.has(scope)))).sort();
}

function buildPermissionsPayload(editPermMode) {
  const permissions = {};
  Object.entries(editPermMode || {}).forEach(([key, mode]) => {
    if (mode === 'allow') permissions[key] = true;
    if (mode === 'deny') permissions[key] = false;
  });
  return Object.keys(permissions).length ? permissions : null;
}

export function buildTeacherListParams(filters = {}) {
  const params = new URLSearchParams();
  params.set('pageSize', '500');
  ['role', 'teacherLevel', 'staffLevel', 'status'].forEach((key) => {
    if (filters[key] && filters[key] !== 'all') {
      params.set(key, filters[key]);
    }
  });
  if (filters.mustResetPassword && filters.mustResetPassword !== 'all') {
    params.set('mustResetPassword', filters.mustResetPassword);
  }
  const search = cleanString(filters.search || '');
  if (search) {
    params.set('search', search);
  }
  return params;
}

export function accountHasCustomOverrides(account) {
  const permissions = account?.permissions;
  const hasPermissions =
    permissions && typeof permissions === 'object' && Object.keys(permissions).length > 0;
  const hasScopes = Array.isArray(account?.scopes) && account.scopes.length > 0;
  return !!(hasPermissions || hasScopes);
}

export function accountHasSystemOverrideInJson(account) {
  const permissions = account?.permissions;
  if (!permissions || typeof permissions !== 'object') return false;
  return Object.keys(permissions).some((key) => SYSTEM_ONLY_ASSIGNMENT_KEYS.has(key));
}

export function formatLastLoginShort(lastLoginAt) {
  if (!lastLoginAt) return '從未登入';
  const date = new Date(lastLoginAt);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60 * 1000) return '剛剛';
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  const currentYear = new Date().getFullYear();
  return date.toLocaleDateString('zh-TW', {
    year: date.getFullYear() === currentYear ? undefined : 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

export function buildFilterSummary(filters = {}, displayedCount = 0, totalCount = 0) {
  const parts = [];
  if (filters.role && filters.role !== 'all') parts.push(`角色：${ROLE_LABELS[filters.role] || filters.role}`);
  if (filters.teacherLevel && filters.teacherLevel !== 'all') {
    parts.push(`老師層級：${labelFromOptions(TEACHER_LEVEL_OPTIONS, filters.teacherLevel)}`);
  }
  if (filters.staffLevel && filters.staffLevel !== 'all') {
    parts.push(`行政職務：${labelFromOptions(STAFF_LEVEL_OPTIONS, filters.staffLevel)}`);
  }
  if (filters.status && filters.status !== 'all') {
    parts.push(`狀態：${labelFromOptions(STATUS_FILTER_OPTIONS, filters.status)}`);
  }
  if (filters.mustResetPassword && filters.mustResetPassword !== 'all') {
    parts.push(filters.mustResetPassword === 'true' ? '須改密碼' : '不須改密碼');
  }
  if (filters.systemOverride === 'has') parts.push('含系統層級覆寫');
  if (filters.systemOverride === 'none') parts.push('不含系統層級覆寫');
  if (cleanString(filters.search || '')) parts.push(`關鍵字：「${cleanString(filters.search)}」`);
  const scope = parts.length ? parts.join('、') : '未套用篩選';
  return `${scope}；顯示 ${displayedCount} 筆（已載入 ${totalCount} 筆）`;
}

export function normalizeCreateTeacherBody(createForm) {
  const role = createForm.role || 'teacher';
  const body = {
    name: cleanString(createForm.name || ''),
    username: cleanString(createForm.username || ''),
    email: cleanString(createForm.email || ''),
    role,
    teacherLevel: role === 'teacher' ? (createForm.teacherLevel || 'regular') : null,
    staffLevel: role === 'office_staff' ? (createForm.staffLevel || 'event_lead') : null,
    studentId: role === 'leader' ? (cleanString(createForm.studentId || '') || null) : null,
    department: cleanString(createForm.department || '') || null,
    phone: cleanString(createForm.phone || '') || null,
  };
  const password = cleanString(createForm.password || '');
  if (password) body.password = password;
  return body;
}

export function serializeEditPayload(_editingAccount, editForm, editPermMode, scopeMode, customScopes) {
  const role = editForm.role || 'teacher';
  return {
    name: cleanString(editForm.name || ''),
    username: cleanString(editForm.username || ''),
    email: cleanString(editForm.email || ''),
    role,
    teacherLevel: role === 'teacher' ? (editForm.teacherLevel || 'regular') : null,
    staffLevel: role === 'office_staff' ? (editForm.staffLevel || 'event_lead') : null,
    studentId: role === 'leader' ? (cleanString(editForm.studentId || '') || null) : null,
    isActive: !!editForm.isActive,
    disabledReason: editForm.isActive ? null : (cleanString(editForm.disabledReason || '') || null),
    mustResetPassword: !!editForm.mustResetPassword,
    permissions: buildPermissionsPayload(editPermMode),
    scopes: scopeMode === 'custom' ? normalizeScopeList(customScopes) : null,
  };
}

export function buildEditSnapshot(account, editForm, editPermMode, scopeMode, customScopes) {
  return JSON.stringify({
    id: account?.id ?? null,
    payload: serializeEditPayload(account, editForm, editPermMode, scopeMode, customScopes),
  });
}

export function permissionsSummaryForExport(account) {
  const permissions = account?.permissions;
  const fragments = [];
  if (permissions && typeof permissions === 'object') {
    const allows = [];
    const denies = [];
    Object.entries(permissions).forEach(([key, value]) => {
      if (value === true) allows.push(pickPermissionLabel(key));
      if (value === false) denies.push(pickPermissionLabel(key));
    });
    if (allows.length) fragments.push(`加開：${allows.join('、')}`);
    if (denies.length) fragments.push(`關閉：${denies.join('、')}`);
  }
  if (Array.isArray(account?.scopes) && account.scopes.length) {
    fragments.push(`Scopes：${account.scopes.join('、')}`);
  }
  return fragments.join('；') || '沿用預設';
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function exportAccountsToCsv(accounts = []) {
  const rows = [
    [
      '帳號',
      '姓名',
      'Email',
      '角色',
      '老師層級',
      '行政職務',
      '狀態',
      '須改密碼',
      '自訂覆寫',
      '系統層級覆寫',
      '權限摘要',
      '最後登入',
      'Access Version',
    ],
    ...accounts.map((account) => [
      account.username,
      account.name,
      account.email,
      ROLE_LABELS[account.role] || account.role,
      TEACHER_LEVEL_TABLE_LABEL[account.teacherLevel] || account.teacherLevel || '',
      STAFF_LEVEL_TABLE_LABEL[account.staffLevel] || account.staffLevel || '',
      account.isActive ? '啟用' : '停用',
      account.mustResetPassword ? '是' : '否',
      accountHasCustomOverrides(account) ? '是' : '否',
      accountHasSystemOverrideInJson(account) ? '是' : '否',
      permissionsSummaryForExport(account),
      account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('zh-TW') : '',
      account.accessVersion ?? '',
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
