import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'eears.la.workingSet.v1';
const CHANGE_EVENT = 'eears-la-working-set';
export const WORKING_SET_CAP = 2000;

const EMPTY_CONTEXT = Object.freeze({
  snapshotVersion: '',
  semester: '',
});

const EMPTY_SET = Object.freeze({
  label: '',
  source: '',
  sourcePath: '',
  note: '',
  studentIds: [],
  total: 0,
  truncated: false,
  savedAt: '',
  context: EMPTY_CONTEXT,
});

function readContext(parsed) {
  const ctx = parsed?.context && typeof parsed.context === 'object' ? parsed.context : {};
  return {
    snapshotVersion: String(ctx.snapshotVersion || ''),
    semester: String(ctx.semester || ''),
  };
}

export function normalizeStudentIds(ids, cap = WORKING_SET_CAP) {
  const out = [];
  const seen = new Set();
  const raw = Array.isArray(ids) ? ids : String(ids || '').split(/[,\s]+/);
  for (const item of raw) {
    const id = String(item || '').trim().toUpperCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

export function readWorkingSet() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SET };
    const parsed = JSON.parse(raw);
    const studentIds = normalizeStudentIds(parsed.studentIds);
    return {
      label: String(parsed.label || '這批學生'),
      source: String(parsed.source || ''),
      sourcePath: String(parsed.sourcePath || ''),
      note: String(parsed.note || ''),
      studentIds,
      total: Number(parsed.total) || studentIds.length,
      truncated: Boolean(parsed.truncated) || (Number(parsed.total) > studentIds.length),
      savedAt: String(parsed.savedAt || ''),
      context: readContext(parsed),
    };
  } catch {
    return { ...EMPTY_SET, context: { ...EMPTY_CONTEXT } };
  }
}

export function saveWorkingSet(set) {
  const studentIds = normalizeStudentIds(set?.studentIds);
  const total = Number(set?.total) || studentIds.length;
  const payload = {
    label: String(set?.label || '這批學生').slice(0, 120),
    source: String(set?.source || ''),
    sourcePath: String(set?.sourcePath || ''),
    note: String(set?.note || '').slice(0, 280),
    studentIds,
    total,
    truncated: Boolean(set?.truncated) || total > studentIds.length,
    savedAt: new Date().toISOString(),
    context: readContext(set),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 私密瀏覽或容量滿時，這次導頁仍用記憶體中的名單。
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return payload;
}

/**
 * 只比對這頁真正使用的維度。
 * 選出時沒有綁該維度，就不因目的頁自己的預設值而暫停。
 * 選出時有綁、目前值不同（含被清成空白），則暫停，避免靜默套用。
 */
export function isWorkingSetSuspended(set, scope) {
  if (!set?.studentIds?.length || !scope) return '';
  const checks = [
    ['snapshotVersion', 'snapshot'],
    ['semester', 'semester'],
  ];
  for (const [key, reason] of checks) {
    if (!Object.prototype.hasOwnProperty.call(scope, key)) continue;
    const stored = String(set.context?.[key] || '');
    const current = String(scope[key] || '');
    if (stored && stored !== current) return reason;
  }
  return '';
}

export function rebindWorkingSet(scope = {}) {
  const current = readWorkingSet();
  if (!current.studentIds.length) return current;
  const context = { ...current.context };
  if (Object.prototype.hasOwnProperty.call(scope, 'snapshotVersion')) {
    context.snapshotVersion = String(scope.snapshotVersion || '');
  }
  if (Object.prototype.hasOwnProperty.call(scope, 'semester')) {
    context.semester = String(scope.semester || '');
  }
  return saveWorkingSet({ ...current, context });
}

export function clearWorkingSet() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useLearningAnalyticsWorkingSet(scope) {
  const [set, setSet] = useState(() => readWorkingSet());
  const snapshotVersion = scope && Object.prototype.hasOwnProperty.call(scope, 'snapshotVersion')
    ? String(scope.snapshotVersion || '')
    : undefined;
  const semester = scope && Object.prototype.hasOwnProperty.call(scope, 'semester')
    ? String(scope.semester || '')
    : undefined;

  useEffect(() => {
    const sync = () => setSet(readWorkingSet());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const clear = useCallback(() => {
    clearWorkingSet();
    setSet({ ...EMPTY_SET, context: { ...EMPTY_CONTEXT } });
  }, []);

  const rebind = useCallback(() => {
    const nextScope = {};
    if (snapshotVersion !== undefined) nextScope.snapshotVersion = snapshotVersion;
    if (semester !== undefined) nextScope.semester = semester;
    setSet(rebindWorkingSet(nextScope));
  }, [snapshotVersion, semester]);

  const studentIds = set.studentIds;
  const suspendedReason = isWorkingSetSuspended(set, (
    snapshotVersion === undefined && semester === undefined
      ? null
      : {
        ...(snapshotVersion !== undefined ? { snapshotVersion } : {}),
        ...(semester !== undefined ? { semester } : {}),
      }
  ));
  const withWorkingSet = useCallback((params = {}) => {
    if (!studentIds.length || suspendedReason) return params;
    return { ...params, studentIds };
  }, [studentIds, suspendedReason]);

  return {
    ...set,
    active: studentIds.length > 0,
    suspendedReason,
    applied: studentIds.length > 0 && !suspendedReason,
    clear,
    rebind,
    withWorkingSet,
  };
}
