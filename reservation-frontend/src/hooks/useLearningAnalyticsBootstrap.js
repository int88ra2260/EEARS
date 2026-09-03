import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentSemester } from '../utils/semesterUtils';
import { getLearningAnalyticsMeta } from '../services/learningAnalyticsService';
import {
  buildDefaultFilters,
  filtersToApiParams,
  parseFiltersFromSearchParams,
  pickFilterKeys,
} from '../components/learningAnalytics/learningAnalyticsFilterConstants';

/**
 * @param {{
 *   scopeKeys?: string[] | null,
 *   defaultSemester?: 'current' | 'none',
 * }} [options]
 *   scopeKeys：若指定，僅保留這些篩選鍵（其餘忽略），供細項分析等頁使用。
 *   defaultSemester：無 URL 學期時是否帶入當前學期。預設 'none'（避免誤以為整頁已依學期篩選）。
 *     Offerings 等學期為主軸的頁面請用 'current'。
 */
export function useLearningAnalyticsBootstrap({
  scopeKeys = null,
  defaultSemester = 'none',
} = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterFromUrl = (searchParams.get('semester') || '').trim();
  const token = localStorage.getItem('token') || '';
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [ready, setReady] = useState(false);

  const resolveDefaultSemester = useCallback(() => {
    if (semesterFromUrl) return semesterFromUrl;
    if (defaultSemester === 'current') return getCurrentSemester() || '';
    return '';
  }, [defaultSemester, semesterFromUrl]);

  const narrow = useCallback((next) => (
    scopeKeys?.length ? pickFilterKeys(next, scopeKeys) : next
  ), [scopeKeys]);

  const initialFilters = useMemo(() => {
    const fromUrl = parseFiltersFromSearchParams(searchParams);
    const semester = fromUrl.semester || semesterFromUrl
      || (defaultSemester === 'current' ? (getCurrentSemester() || '') : '');
    const merged = {
      ...buildDefaultFilters({ semester }),
      ...fromUrl,
      semester,
    };
    return scopeKeys?.length ? pickFilterKeys(merged, scopeKeys) : merged;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only URL parse

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  useEffect(() => {
    if (!semesterFromUrl) return;
    setFilters((prev) => {
      if (prev.semester === semesterFromUrl) return prev;
      return narrow({ ...prev, semester: semesterFromUrl });
    });
    setAppliedFilters((prev) => {
      if (prev.semester === semesterFromUrl) return prev;
      return narrow({ ...prev, semester: semesterFromUrl });
    });
  }, [semesterFromUrl, narrow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getLearningAnalyticsMeta(token);
        if (cancelled) return;
        setMeta(payload);
        const recommended = payload.recommendedSnapshotVersion || '';
        if (!recommended) return;
        setFilters((prev) => {
          if (prev.snapshot_version) return prev;
          return narrow({ ...prev, snapshot_version: recommended });
        });
        setAppliedFilters((prev) => {
          if (prev.snapshot_version) return prev;
          return narrow({ ...prev, snapshot_version: recommended });
        });
      } catch (e) {
        if (!cancelled) setMetaError(e.message || '無法載入分析中繼資料');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token, narrow]);

  const apiParams = useCallback(
    () => filtersToApiParams(appliedFilters),
    [appliedFilters]
  );

  const writeUrl = useCallback((nextFilters) => {
    const next = new URLSearchParams();
    Object.entries(filtersToApiParams(nextFilters)).forEach(([key, value]) => {
      if (key !== 'snapshot_version') next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const applyFilters = useCallback(() => {
    const nextFilters = narrow({ ...filters });
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    writeUrl(nextFilters);
  }, [filters, narrow, writeUrl]);

  const resetFilters = useCallback(() => {
    const reset = narrow(buildDefaultFilters({
      semester: resolveDefaultSemester(),
      snapshotVersion: meta?.recommendedSnapshotVersion || '',
    }));
    setFilters(reset);
    setAppliedFilters(reset);
    writeUrl(reset);
  }, [meta, narrow, resolveDefaultSemester, writeUrl]);

  return {
    token,
    meta,
    metaError,
    filters,
    setFilters,
    appliedFilters,
    applyFilters,
    resetFilters,
    ready,
    apiParams,
    semesterFromUrl,
  };
}
