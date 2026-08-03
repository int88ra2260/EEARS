import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { P } from '../constants/permissions';
import {
  archiveLearningJourneyOperationRuns,
  cleanupLearningJourneyOperationRunsDryRun,
  exportLearningJourneyOperationRunsCsv,
  getLearningJourneyOperationRunDetail,
  getLearningJourneyOperationRuns,
  getLearningJourneyV3ImportHistories,
} from '../services/learningJourneyV3Api';
import { buildAccessProfile, hasPermission } from '../utils/accessControl';
import {
  DEFAULT_LIMIT,
  buildOperationRunsCsv,
  defaultCleanupOlderThan,
  downloadBlob,
  downloadTextFile,
  latestFinishedRun,
  latestImportHistoryAt,
  latestStartedRun,
  parseLimit,
  parseOffset,
  yyyymmdd,
} from '../utils/learningJourneyOperationsHelpers';

export default function useLearningJourneyOperations() {
  const token = localStorage.getItem('token') || '';
  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', localStorage.getItem('userRole') || ''),
    [token]
  );
  const canManageLj = hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    semesterId: searchParams.get('semesterId') || '',
    operationType: searchParams.get('operationType') || '',
    status: searchParams.get('status') || '',
    requestId: searchParams.get('requestId') || '',
    warningsOnly: searchParams.get('warningsOnly') === 'true',
    startedFrom: searchParams.get('startedFrom') || '',
    startedTo: searchParams.get('startedTo') || '',
    includeArchived: searchParams.get('includeArchived') === 'true',
    limit: parseLimit(searchParams.get('limit')),
    offset: parseOffset(searchParams.get('offset')),
  });
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ limit: DEFAULT_LIMIT, offset: 0, returned: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryRuns, setSummaryRuns] = useState([]);
  const [importHistories, setImportHistories] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [exportingFiltered, setExportingFiltered] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [cleanupCriteria, setCleanupCriteria] = useState({
    olderThan: defaultCleanupOlderThan(),
    operationType: '',
    status: 'success',
    includeNonSuccess: false,
  });
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupError, setCleanupError] = useState(null);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [archiveForm, setArchiveForm] = useState({
    backupConfirmed: false,
    confirmArchive: false,
    reason: '',
  });
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [archiveResult, setArchiveResult] = useState(null);

  const appliedParams = useMemo(() => ({
    semesterId: searchParams.get('semesterId') || '',
    operationType: searchParams.get('operationType') || '',
    status: searchParams.get('status') || '',
    requestId: searchParams.get('requestId') || '',
    warningsOnly: searchParams.get('warningsOnly') === 'true' ? 'true' : '',
    startedFrom: searchParams.get('startedFrom') || '',
    startedTo: searchParams.get('startedTo') || '',
    includeArchived: searchParams.get('includeArchived') === 'true' ? 'true' : '',
    limit: parseLimit(searchParams.get('limit')),
    offset: parseOffset(searchParams.get('offset')),
  }), [searchParams]);

  useEffect(() => {
    setFilters({
      semesterId: appliedParams.semesterId,
      operationType: appliedParams.operationType,
      status: appliedParams.status,
      requestId: appliedParams.requestId,
      warningsOnly: appliedParams.warningsOnly === 'true',
      startedFrom: appliedParams.startedFrom,
      startedTo: appliedParams.startedTo,
      includeArchived: appliedParams.includeArchived === 'true',
      limit: appliedParams.limit,
      offset: appliedParams.offset,
    });
  }, [appliedParams]);

  const loadRuns = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLearningJourneyOperationRuns(token, appliedParams);
      setRows(Array.isArray(data?.items) ? data.items : []);
      setPagination(data?.pagination || { limit: appliedParams.limit, offset: appliedParams.offset, returned: 0 });
    } catch (err) {
      setRows([]);
      setError({
        message: err.message || '讀取資料維運紀錄失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setLoading(false);
    }
  }, [appliedParams, token]);

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const params = { limit: 100, offset: 0 };
      if (appliedParams.semesterId) params.semesterId = appliedParams.semesterId;
      const [runData, historyData] = await Promise.all([
        getLearningJourneyOperationRuns(token, params),
        getLearningJourneyV3ImportHistories(token, appliedParams.semesterId, 100).catch(() => ({ items: [] })),
      ]);
      setSummaryRuns(Array.isArray(runData?.items) ? runData.items : []);
      setImportHistories(Array.isArray(historyData?.items) ? historyData.items : []);
    } catch (err) {
      setSummaryRuns([]);
      setImportHistories([]);
      setSummaryError({
        message: err.message || '讀取資料新鮮度摘要失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [appliedParams.semesterId, token]);

  useEffect(() => {
    loadRuns();
    loadSummary();
  }, [loadRuns, loadSummary]);

  const freshnessSummary = useMemo(() => {
    const enrollmentRun = latestFinishedRun(summaryRuns, (row) => row.operationType === 'IMPORT_ENROLLMENT' && row.status === 'success');
    const examRun = latestFinishedRun(summaryRuns, (row) => row.operationType === 'IMPORT_EXAM' && row.status === 'success');
    const rebuildRun = latestFinishedRun(summaryRuns, (row) => row.operationType === 'REBUILD_BEST_SKILL_PROJECTION' && row.status === 'success');
    const failedRun = latestStartedRun(summaryRuns, (row) => row.status === 'failed');
    const warningRun = latestStartedRun(summaryRuns, (row) => Number(row.warningsCount || 0) > 0);
    const latestRun = latestStartedRun(summaryRuns, () => true);
    const enrollmentFallback = latestImportHistoryAt(importHistories, 'enrollment');
    const examFallback = latestImportHistoryAt(importHistories, 'external_exam');
    return {
      enrollmentImportAt: enrollmentRun?.finishedAt || enrollmentFallback,
      enrollmentImportSource: enrollmentRun ? 'Operation Runs' : (enrollmentFallback ? 'Import Histories fallback' : ''),
      examImportAt: examRun?.finishedAt || examFallback,
      examImportSource: examRun ? 'Operation Runs' : (examFallback ? 'Import Histories fallback' : ''),
      rebuildAt: rebuildRun?.finishedAt || '',
      failedRun,
      warningRun,
      latestRunAt: latestRun?.startedAt || latestRun?.finishedAt || '',
    };
  }, [importHistories, summaryRuns]);

  const applyFilters = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (filters.semesterId.trim()) next.set('semesterId', filters.semesterId.trim());
    if (filters.operationType) next.set('operationType', filters.operationType);
    if (filters.status) next.set('status', filters.status);
    if (filters.requestId.trim()) next.set('requestId', filters.requestId.trim());
    if (filters.warningsOnly) next.set('warningsOnly', 'true');
    if (filters.startedFrom) next.set('startedFrom', filters.startedFrom);
    if (filters.startedTo) next.set('startedTo', filters.startedTo);
    if (canManageLj && filters.includeArchived) next.set('includeArchived', 'true');
    next.set('limit', String(parseLimit(filters.limit)));
    next.set('offset', '0');
    setSearchParams(next);
  };

  const applyQuickFilter = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.set('offset', '0');
    if (!next.get('limit')) next.set('limit', String(appliedParams.limit || DEFAULT_LIMIT));
    setSearchParams(next);
  };

  const setPageOffset = (offset) => {
    const next = new URLSearchParams(searchParams);
    next.set('limit', String(appliedParams.limit));
    next.set('offset', String(Math.max(offset, 0)));
    setSearchParams(next);
  };

  const openDetail = async (id, updateQuery = true) => {
    if (!token || !id) return;
    if (updateQuery) {
      const next = new URLSearchParams(searchParams);
      next.set('runId', String(id));
      setSearchParams(next, { replace: true });
    }
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const data = await getLearningJourneyOperationRunDetail(token, id);
      setDetail(data);
    } catch (err) {
      setDetailError({
        message: err.message || '讀取操作詳情失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('runId');
    setSearchParams(next, { replace: true });
    setDetail(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  useEffect(() => {
    const runId = searchParams.get('runId');
    if (runId && !detailLoading && String(detail?.id || '') !== runId) {
      openDetail(runId, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const copyRequestId = async (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyMessage('requestId 已複製');
      } else {
        window.prompt('請手動複製 requestId', text);
        setCopyMessage('請手動複製 requestId');
      }
    } catch (_) {
      window.prompt('請手動複製 requestId', text);
      setCopyMessage('請手動複製 requestId');
    }
    window.setTimeout(() => setCopyMessage(''), 2500);
  };

  const exportCurrentPageCsv = () => {
    const csv = buildOperationRunsCsv(rows);
    downloadTextFile(`learning-journey-operation-runs-${yyyymmdd()}.csv`, csv);
  };

  const exportFilteredCsv = async () => {
    if (!token) return;
    setExportingFiltered(true);
    setExportError(null);
    try {
      const params = { ...appliedParams };
      delete params.limit;
      delete params.offset;
      delete params.runId;
      const data = await exportLearningJourneyOperationRunsCsv(token, params);
      downloadBlob(data.filename, data.blob);
    } catch (err) {
      setExportError({
        message: err.message || '匯出篩選結果 CSV 失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setExportingFiltered(false);
    }
  };

  const runCleanupDryRun = async () => {
    setCleanupLoading(true);
    setCleanupError(null);
    setCleanupResult(null);
    setArchiveError(null);
    setArchiveResult(null);
    try {
      const data = await cleanupLearningJourneyOperationRunsDryRun(token, cleanupCriteria);
      setCleanupResult(data);
    } catch (err) {
      setCleanupError({
        message: err.message || 'cleanup dry-run 失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setCleanupLoading(false);
    }
  };

  const runCleanupArchive = async () => {
    const matchedCount = Number(cleanupResult?.summary?.matchedCount || 0);
    if (!token || matchedCount <= 0) return;
    if (!archiveForm.backupConfirmed || !archiveForm.confirmArchive || !archiveForm.reason.trim()) {
      setArchiveError({ message: '請先確認已匯出備份、了解封存行為，並填寫 archive reason。', requestId: '' });
      return;
    }
    const ok = window.confirm(
      [
        `即將封存 ${matchedCount} 筆 operation runs。`,
        `olderThan: ${cleanupCriteria.olderThan || '—'}`,
        `operationType: ${cleanupCriteria.operationType || '全部'}`,
        `status: ${cleanupCriteria.status || '全部非 running'}`,
        `includeNonSuccess: ${cleanupCriteria.includeNonSuccess ? 'true' : 'false'}`,
        '此操作不是 hard delete，會寫入 archived_at 並預設從列表排除。',
      ].join('\n')
    );
    if (!ok) return;
    setArchiveLoading(true);
    setArchiveError(null);
    setArchiveResult(null);
    try {
      const data = await archiveLearningJourneyOperationRuns(token, {
        ...cleanupCriteria,
        confirm: true,
        backupConfirmed: true,
        reason: archiveForm.reason.trim(),
      });
      setArchiveResult(data);
      await loadRuns();
      await loadSummary();
    } catch (err) {
      setArchiveError({
        message: err.message || 'cleanup archive 失敗',
        requestId: err.requestId || '',
      });
    } finally {
      setArchiveLoading(false);
    }
  };

  const hasNextPage = pagination.total == null
    ? Number(pagination.returned || 0) >= Number(pagination.limit || appliedParams.limit)
    : Number(pagination.offset || 0) + Number(pagination.returned || 0) < Number(pagination.total || 0);

  const reloadAll = () => {
    loadRuns();
    loadSummary();
  };

  return {
    token,
    canManageLj,
    appliedParams,
    filters,
    setFilters,
    rows,
    pagination,
    loading,
    error,
    summaryLoading,
    summaryError,
    freshnessSummary,
    detail,
    detailLoading,
    detailError,
    copyMessage,
    exportingFiltered,
    exportError,
    cleanupCriteria,
    setCleanupCriteria,
    cleanupLoading,
    cleanupError,
    cleanupResult,
    archiveForm,
    setArchiveForm,
    archiveLoading,
    archiveError,
    archiveResult,
    hasNextPage,
    loadSummary,
    reloadAll,
    applyFilters,
    applyQuickFilter,
    setPageOffset,
    openDetail,
    closeDetail,
    copyRequestId,
    exportCurrentPageCsv,
    exportFilteredCsv,
    runCleanupDryRun,
    runCleanupArchive,
  };
}
