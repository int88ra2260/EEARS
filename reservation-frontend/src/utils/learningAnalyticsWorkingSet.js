import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'eears.la.workingSet.v1';
const CHANGE_EVENT = 'eears-la-working-set';
export const WORKING_SET_CAP = 2000;

const EMPTY_SET = Object.freeze({
  label: '',
  source: '',
  sourcePath: '',
  note: '',
  studentIds: [],
  total: 0,
  truncated: false,
  savedAt: '',
});

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
    };
  } catch {
    return { ...EMPTY_SET };
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
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 私密瀏覽或容量滿時，這次導頁仍用記憶體中的名單。
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return payload;
}

export function clearWorkingSet() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useLearningAnalyticsWorkingSet() {
  const [set, setSet] = useState(() => readWorkingSet());

  useEffect(() => {
    const sync = () => setSet(readWorkingSet());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const clear = useCallback(() => {
    clearWorkingSet();
    setSet({ ...EMPTY_SET });
  }, []);

  const studentIds = set.studentIds;
  const withWorkingSet = useCallback((params = {}) => {
    if (!studentIds.length) return params;
    return { ...params, studentIds };
  }, [studentIds]);

  return {
    ...set,
    active: studentIds.length > 0,
    clear,
    withWorkingSet,
  };
}
