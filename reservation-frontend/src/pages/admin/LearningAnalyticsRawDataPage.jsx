import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import {
  exportLearningAnalyticsRawData,
  getLearningAnalyticsRawData,
} from '../../services/learningAnalyticsService';
import LearningAnalyticsDataHealth from '../../components/learningAnalytics/LearningAnalyticsDataHealth';
import LearningAnalyticsFilters, { LearningAnalyticsActiveFilters } from '../../components/learningAnalytics/LearningAnalyticsFilters';
import LearningAnalyticsRawDataPreview from '../../components/learningAnalytics/LearningAnalyticsRawDataPreview';
import { DATASET_OPTIONS } from '../../components/learningAnalytics/learningAnalyticsRawDataColumns';
import { useLearningAnalyticsBootstrap } from '../../hooks/useLearningAnalyticsBootstrap';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { downloadBlob } from '../../utils/learningJourneyOperationsHelpers';
import { P } from '../../constants/permissions';

const MAX_EXPORT_STUDENTS = 5000;
const MAX_EXPORT_EXAMS = 20000;
const MAX_EXPORT_EVENTS = 30000;
const DEFAULT_PAGE_SIZE = 50;

export default function LearningAnalyticsRawDataPage() {
  const {
    meta,
    metaError,
    filters,
    setFilters,
    appliedFilters,
    applyFilters,
    resetFilters,
    ready,
    apiParams,
    token,
  } = useLearningAnalyticsBootstrap();
  const [dataset, setDataset] = useState('students');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [data, setData] = useState(null);

  const accessProfile = useMemo(() => buildAccessProfile(token), [token]);
  const canExport = hasPermission(accessProfile, P.CAN_EXPORT_LEARNING_ANALYTICS);
  const datasetMeta = DATASET_OPTIONS.find((o) => o.value === dataset) || DATASET_OPTIONS[0];

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError('');
    try {
      const payload = await getLearningAnalyticsRawData(token, {
        ...apiParams(),
        dataset,
        limit: pageSize,
        offset,
      });
      setData(payload);
    } catch (e) {
      setData(null);
      setError(e.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, [token, apiParams, dataset, offset, pageSize, ready]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApplyFilters = useCallback(() => {
    setOffset(0);
    applyFilters();
  }, [applyFilters]);

  const handleResetFilters = useCallback(() => {
    setOffset(0);
    resetFilters();
  }, [resetFilters]);

  const handleDatasetChange = useCallback((value) => {
    setDataset(value);
    setOffset(0);
  }, []);

  const handlePageSizeChange = useCallback((nextSize) => {
    setPageSize(nextSize);
    setOffset(0);
  }, []);

  const handleExport = useCallback(async (format = 'xlsx') => {
    if (!canExport || !ready) return;
    setExporting(true);
    setExportError('');
    try {
      const { blob, fileName } = await exportLearningAnalyticsRawData(token, {
        ...apiParams(),
        dataset,
        format,
      });
      downloadBlob(fileName, blob);
    } catch (e) {
      setExportError(e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  }, [apiParams, canExport, dataset, ready, token]);

  const rows = data?.items || [];
  const exportCap = dataset === 'exams'
    ? MAX_EXPORT_EXAMS
    : ['courses', 'activities', 'events'].includes(dataset)
      ? MAX_EXPORT_EVENTS
      : MAX_EXPORT_STUDENTS;
  const totalRows = data?.total ?? rows.length;
  const exportTruncatedHint = totalRows > exportCap
    ? `符合條件共 ${totalRows.toLocaleString('zh-TW')} 筆；匯出 Excel 最多 ${exportCap.toLocaleString('zh-TW')} 筆，其餘請縮小篩選範圍後分批匯出。`
    : null;

  return (
    <div>
      <LearningAnalyticsDataHealth meta={meta} error={metaError} />

      <p className="small text-muted mb-3">預覽或匯出底層摘要。預覽最多 100 筆，完整資料請匯出。</p>

      <LearningAnalyticsFilters
        filters={filters}
        onChange={setFilters}
        onSubmit={handleApplyFilters}
        onReset={handleResetFilters}
        loading={loading || !ready}
        filterOptions={meta?.filterOptions}
        matchingCaliperDefault={meta?.matchingCaliperDefault}
        filterTitle="篩選條件"
        submitLabel="套用篩選"
        showAdvanced={false}
      />
      <LearningAnalyticsActiveFilters filters={appliedFilters} />

      <div className="la-panel mt-3 mb-3">
        <Row className="g-3 align-items-end">
          <Col md={5} lg={4}>
            <Form.Group className="mb-0">
              <Form.Label className="small text-muted mb-1">要預覽／匯出的資料</Form.Label>
              <Form.Select
                value={dataset}
                onChange={(e) => handleDatasetChange(e.target.value)}
                disabled={loading || exporting}
              >
                {DATASET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">{datasetMeta.hint}</Form.Text>
            </Form.Group>
          </Col>
          <Col md="auto" className="d-flex flex-wrap gap-2">
            <Button variant="outline-secondary" size="sm" onClick={load} disabled={loading || exporting}>
              重新載入預覽
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('xlsx')}
              disabled={!canExport || !ready || loading || exporting}
              title={canExport ? undefined : '需要「學習成效分析（匯出）」權限'}
            >
              {exporting ? '匯出中…' : '匯出 XLSX'}
            </Button>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => handleExport('csv')}
              disabled={!canExport || !ready || loading || exporting}
              title={canExport ? undefined : '需要「學習成效分析（匯出）」權限'}
            >
              匯出 CSV
            </Button>
          </Col>
        </Row>
      </div>

      {!canExport ? (
        <Alert variant="light" className="small py-2 border">
          您目前僅可預覽資料；匯出 Excel 需「學習成效分析（匯出）」權限。
        </Alert>
      ) : null}
      {exportTruncatedHint ? (
        <Alert variant="info" className="small py-2">{exportTruncatedHint}</Alert>
      ) : null}
      {exportError ? <Alert variant="danger">{exportError}</Alert> : null}
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" />
          <div className="text-muted mt-2 small">載入預覽資料…</div>
        </div>
      ) : null}

      {!loading && data ? (
        <LearningAnalyticsRawDataPreview
          dataset={dataset}
          data={data}
          rows={rows}
          loading={loading}
          offset={offset}
          pageSize={pageSize}
          onOffsetChange={setOffset}
          onPageSizeChange={handlePageSizeChange}
        />
      ) : null}
    </div>
  );
}
