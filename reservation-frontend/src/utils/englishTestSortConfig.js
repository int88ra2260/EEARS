/**
 * 培力英檢列表／匯出排序：最多五層（先 A 再 B…）。
 * 對外仍提供 .key / .direction（等同第一層）以相容表格欄位點選。
 */

export const MAX_SORT_LEVELS = 5;

export const ENGLISH_TEST_SORT_FIELD_OPTIONS = [
  { value: 'id', label: '報名編號' },
  { value: 'successSequence', label: '報名成功序號' },
  { value: 'status', label: '狀態' },
  { value: 'studentId', label: '學號' },
  { value: 'name', label: '姓名' },
  { value: 'email', label: 'Email' },
  { value: 'college', label: '學院' },
  { value: 'department', label: '科系' },
  { value: 'grade', label: '年級' },
  { value: 'examType', label: '報考項目' },
  { value: 'createdAt', label: '報名時間' },
  { value: 'approvedAt', label: '通過時間' },
  { value: 'updatedAt', label: '更新時間' },
];

const VALID_KEYS = new Set(ENGLISH_TEST_SORT_FIELD_OPTIONS.map((o) => o.value));
const DEFAULT_LEVEL = { key: 'id', direction: 'ASC' };

function normalizeDirection(raw) {
  const d = String(raw || 'ASC').toUpperCase();
  return d === 'DESC' ? 'DESC' : 'ASC';
}

function normalizeLevel(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const key = String(raw.key || '').trim();
  if (!VALID_KEYS.has(key)) return null;
  return { key, direction: normalizeDirection(raw.direction) };
}

/**
 * @param {unknown} raw - { key, direction } | { levels } | levels[]
 * @returns {{ levels: Array<{key: string, direction: 'ASC'|'DESC'}>, key: string, direction: 'ASC'|'DESC' }}
 */
export function normalizeSortConfig(raw) {
  let levels = [];

  if (Array.isArray(raw)) {
    levels = raw.map(normalizeLevel).filter(Boolean);
  } else if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.levels)) {
      levels = raw.levels.map(normalizeLevel).filter(Boolean);
    } else {
      const one = normalizeLevel(raw);
      if (one) levels = [one];
    }
  }

  // 去重：後層若與前層同 key 則略過
  const seen = new Set();
  const unique = [];
  for (const level of levels) {
    if (seen.has(level.key)) continue;
    seen.add(level.key);
    unique.push(level);
    if (unique.length >= MAX_SORT_LEVELS) break;
  }

  if (unique.length === 0) {
    unique.push({ ...DEFAULT_LEVEL });
  }

  return {
    levels: unique,
    key: unique[0].key,
    direction: unique[0].direction,
  };
}

export function createPrimarySortConfig(key, direction = 'ASC') {
  return normalizeSortConfig({ key, direction });
}

export function createSortConfigFromLevels(levels) {
  return normalizeSortConfig({ levels });
}

/**
 * 表頭點選：一般＝設為唯一第一層；Shift＝疊加或切換該欄方向。
 * @returns {{ config: ReturnType<typeof normalizeSortConfig>, capped: boolean }}
 */
export function applyHeaderSortClick(currentConfig, key, { shiftKey = false } = {}) {
  const fieldKey = String(key || '').trim();
  if (!VALID_KEYS.has(fieldKey)) {
    return { config: normalizeSortConfig(currentConfig), capped: false };
  }

  if (!shiftKey) {
    const current = normalizeSortConfig(currentConfig);
    const direction = current.key === fieldKey && current.direction === 'ASC' ? 'DESC' : 'ASC';
    return { config: createPrimarySortConfig(fieldKey, direction), capped: false };
  }

  const { levels } = normalizeSortConfig(currentConfig);
  const index = levels.findIndex((l) => l.key === fieldKey);
  if (index >= 0) {
    const next = levels.map((level, i) => (
      i === index
        ? { ...level, direction: level.direction === 'ASC' ? 'DESC' : 'ASC' }
        : level
    ));
    return { config: createSortConfigFromLevels(next), capped: false };
  }
  if (levels.length >= MAX_SORT_LEVELS) {
    return { config: createSortConfigFromLevels(levels), capped: true };
  }
  return {
    config: createSortConfigFromLevels([...levels, { key: fieldKey, direction: 'ASC' }]),
    capped: false,
  };
}

/** 寫入 URLSearchParams：sortBy=a,b,c & sortOrder=ASC,DESC,ASC */
export function appendSortQueryParams(params, sortConfig) {
  const { levels } = normalizeSortConfig(sortConfig);
  params.set('sortBy', levels.map((l) => l.key).join(','));
  params.set('sortOrder', levels.map((l) => l.direction).join(','));
  return params;
}
