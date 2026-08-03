import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentSemester } from '../utils/semesterUtils';
import { getLearningAnalyticsMeta } from '../services/learningAnalyticsService';
import {
  buildDefaultFilters,
  filtersToApiParams,
  parseFiltersFromSearchParams,
} from '../components/learningAnalytics/learningAnalyticsFilterConstants';

export function useLearningAnalyticsBootstrap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterFromUrl = (searchParams.get('semester') || '').trim();
  const token = localStorage.getItem('token') || '';
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [ready, setReady] = useState(false);

  const initialFilters = useMemo(() => {
    const fromUrl = parseFiltersFromSearchParams(searchParams);
    const semester = fromUrl.semester || semesterFromUrl || getCurrentSemester() || '';
    return buildDefaultFilters({ semester });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only URL parse

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  useEffect(() => {
    if (!semesterFromUrl) return;
    setFilters((prev) => (
      prev.semester === semesterFromUrl ? prev : { ...prev, semester: semesterFromUrl }
    ));
    setAppliedFilters((prev) => (
      prev.semester === semesterFromUrl ? prev : { ...prev, semester: semesterFromUrl }
    ));
  }, [semesterFromUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getLearningAnalyticsMeta(token);
        if (cancelled) return;
        setMeta(payload);
        const recommended = payload.recommendedSnapshotVersion || '';
        if (!recommended) return;
        setFilters((prev) => ({ ...prev, snapshot_version: recommended }));
        setAppliedFilters((prev) => ({ ...prev, snapshot_version: recommended }));
      } catch (e) {
        if (!cancelled) setMetaError(e.message || '無法載入分析中繼資料');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const apiParams = useCallback(
    () => filtersToApiParams(appliedFilters),
    [appliedFilters]
  );

  const applyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
    const next = new URLSearchParams();
    Object.entries(filtersToApiParams(filters)).forEach(([key, value]) => {
      if (key !== 'snapshot_version') next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [filters, setSearchParams]);

  const resetFilters = useCallback(() => {
    const reset = buildDefaultFilters({
      semester: semesterFromUrl || getCurrentSemester() || '',
      snapshotVersion: meta?.recommendedSnapshotVersion || '',
    });
    setFilters(reset);
    setAppliedFilters(reset);
    const next = new URLSearchParams();
    if (reset.semester) next.set('semester', reset.semester);
    setSearchParams(next, { replace: true });
  }, [meta, semesterFromUrl, setSearchParams]);

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
