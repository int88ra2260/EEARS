import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { buildAccessProfile, hasPermission } from '../../utils/accessControl';
import { P } from '../../constants/permissions';
import {
  Alert,
  Accordion,
  Button,
  Col,
  Form,
  Offcanvas,
  Row,
  Spinner,
  Table,
} from 'react-bootstrap';
import StatusBadge from '../../components/ui/StatusBadge';
import { importRunStatusToVariant } from '../../utils/statusBadgeUtils';
import { deleteImportRun, fetchImportRunDetail, fetchImportRuns } from '../../services/importRunHistoryApi';
import {
  buildAppliedFiltersSummary,
  buildDeleteImportRunConfirmMessage,
  canDeleteImportRunByPermission,
  formatCount,
  formatDateTime,
  formatImportTypeLabel,
  formatModuleLabel,
  formatSourceLabel,
  formatStatusLabel,
  getDeleteDisabledTooltip,
  getNoDetailTooltip,
  IMPORT_RUN_MODULE_OPTIONS,
  IMPORT_RUN_SOURCE_OPTIONS,
  IMPORT_RUN_STATUS_OPTIONS,
  IMPORT_RUN_TYPE_OPTIONS,
  pickDisplayTime,
} from '../../constants/importRunHistoryFormatters';
import '../../styles/import-center.css';

const DEFAULT_LIMIT = 50;

const EMPTY_FILTERS = {
  source: '',
  importType: '',
  module: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  keyword: '',
  limit: String(DEFAULT_LIMIT),
  offset: '0',
};

function parseLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(n), 1), 200);
}

function parseOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(Math.floor(n), 0);
}

function buildQueryParams(filters) {
  const params = {
    limit: parseLimit(filters.limit),
    offset: parseOffset(filters.offset),
  };
  if (filters.source) params.source = filters.source;
  if (filters.importType) params.importType = filters.importType;
  if (filters.module) params.module = filters.module;
  if (filters.status) params.status = filters.status;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.keyword?.trim()) params.keyword = filters.keyword.trim();
  return params;
}

function DetailSection({ title, children }) {
  return (
    <section className="mb-3">
      <div className="fw-semibold small text-secondary mb-2 border-bottom pb-1">{title}</div>
      {children}
    </section>
  );
}

export default function ImportRunHistoryPage() {
  const { token, userRole } = useOutletContext();
  const accessProfile = useMemo(
    () => buildAccessProfile(token || '', userRole || ''),
    [token, userRole],
  );
  const canDeleteAny =
    accessProfile.isAdmin ||
    accessProfile.hasAdminRights ||
    hasPermission(accessProfile, P.CAN_IMPORT_BESTEP) ||
    hasPermission(accessProfile, P.CAN_MANAGE_ENGLISH_TEST_TRACKING) ||
    hasPermission(accessProfile, P.CAN_MANAGE_CLASSES) ||
    hasPermission(accessProfile, P.CAN_MANAGE_EVENTS) ||
    hasPermission(accessProfile, P.CAN_CHECKIN_STUDENTS);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [pagination, setPagination] = useState({
    limit: DEFAULT_LIMIT,
    offset: 0,
    returned: 0,
    totalApprox: 0,
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detail, setDetail] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [deletingRunId, setDeletingRunId] = useState(null);

  const loadRuns = useCallback(
    async (filters) => {
      if (!token) {
        setError('尚未登入，請重新登入後再試。');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const params = buildQueryParams(filters);
        const body = await fetchImportRuns(token, params);
        const data = body?.data || {};
        setItems(Array.isArray(data.items) ? data.items : []);
        setWarnings(Array.isArray(body.warnings) ? body.warnings : []);
        setPagination({
          limit: data.pagination?.limit ?? params.limit,
          offset: data.pagination?.offset ?? params.offset,
          returned: data.pagination?.returned ?? (data.items?.length || 0),
          totalApprox: data.pagination?.totalApprox ?? (data.items?.length || 0),
        });
        setAppliedFilters({
          ...filters,
          limit: String(params.limit),
          offset: String(params.offset),
        });
      } catch (err) {
        setItems([]);
        setWarnings([]);
        setError(err?.message || '載入匯入紀錄失敗');
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const openDetail = useCallback(
    async (row) => {
      if (!row || !row.detailAvailable) return;
      setSelectedRow(row);
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailLoadingId(row.id);
      setDetailError('');
      setDetail(null);
      try {
        const body = await fetchImportRunDetail(token, row.source, row.sourceId);
        setDetail(body?.data || null);
      } catch (err) {
        setDetailError(err?.message || '載入明細失敗');
      } finally {
        setDetailLoading(false);
        setDetailLoadingId(null);
      }
    },
    [token],
  );

  useEffect(() => {
    loadRuns(EMPTY_FILTERS);
  }, [loadRuns]);

  const handleFilterChange = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const next = { ...draftFilters, offset: '0' };
    setDraftFilters(next);
    loadRuns(next);
  };

  const handleReset = () => {
    setDraftFilters(EMPTY_FILTERS);
    loadRuns(EMPTY_FILTERS);
  };

  const handlePage = (direction) => {
    const limit = parseLimit(appliedFilters.limit);
    const offset = parseOffset(appliedFilters.offset);
    const nextOffset = direction === 'next' ? offset + limit : Math.max(offset - limit, 0);
    const next = { ...appliedFilters, offset: String(nextOffset) };
    setDraftFilters(next);
    loadRuns(next);
  };

  const canGoPrev = parseOffset(appliedFilters.offset) > 0;
  const canGoNext = useMemo(() => {
    const limit = parseLimit(appliedFilters.limit);
    const offset = parseOffset(appliedFilters.offset);
    return offset + limit < (pagination.totalApprox || 0);
  }, [appliedFilters.limit, appliedFilters.offset, pagination.totalApprox]);

  const querySummary = useMemo(
    () => buildAppliedFiltersSummary(appliedFilters),
    [appliedFilters],
  );

  const detailRow = detail || null;
  const detailTime = detailRow ? pickDisplayTime(detailRow) : null;
  const drawerTitleRow = detailRow || selectedRow;

  const closeDetail = () => {
    setDetailOpen(false);
    setSelectedRow(null);
    setDetailError('');
    setDetail(null);
  };

  const canDeleteRow = useCallback(
    (row) => {
      if (!row?.deletable || !canDeleteAny) return false;
      return canDeleteImportRunByPermission(accessProfile, row);
    },
    [accessProfile, canDeleteAny],
  );

  const handleDeleteRun = useCallback(
    async (row) => {
      if (!row?.source || !row?.sourceId || !canDeleteRow(row)) return;
      const confirmMsg = buildDeleteImportRunConfirmMessage(row);
      if (!window.confirm(confirmMsg)) return;
      setDeletingRunId(row.id);
      setError('');
      try {
        await deleteImportRun(token, row.source, row.sourceId);
        if (selectedRow?.id === row.id) {
          closeDetail();
        }
        await loadRuns(appliedFilters);
      } catch (err) {
        setError(err?.message || '刪除匯入紀錄失敗');
      } finally {
        setDeletingRunId(null);
      }
    },
    [token, canDeleteRow, selectedRow?.id, loadRuns, appliedFilters],
  );

  return (
    <div className="container-fluid py-3 import-run-history-page">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h1 className="import-run-history-page__title mb-1">匯入紀錄中心</h1>
          <p className="text-muted small mb-0">
            <Link to="/admin/import-center">← 返回資料匯入中心</Link>
          </p>
        </div>
      </div>

      <Alert variant="info" className="mb-3 py-2 small">
        <span className="fw-semibold">匯入紀錄查詢</span>
        ：整合各模組最近匯入與同步紀錄。
        {canDeleteAny ? (
          <span className="d-block mt-1">
            具權限者可在列表<strong className="text-body">刪除</strong>
            支援的紀錄：含 BESTEP、英語學習歷程、班級名冊、活動刷卡匯入，以及 Job／LJ 維運執行紀錄（後兩者僅移除紀錄本身）。
          </span>
        ) : null}
        <span className="d-block mt-1 text-muted">
          部分舊資料僅有<strong className="text-body">稽核摘要</strong>（來源為 audit_log），不代表完整匯入明細；無 batchId
          的舊 BESTEP 匯入將依匯入時間窗口嘗試回滾。
        </span>
      </Alert>

      {warnings.length > 0 ? (
        <Alert variant="warning" className="mb-3 py-2 small">
          <details>
            <summary className="fw-semibold" style={{ cursor: 'pointer' }}>
              部分資料來源暫時無法載入（其餘紀錄仍可查詢，共 {warnings.length} 項）
            </summary>
            <ul className="mb-0 mt-2 ps-3">
              {warnings.map((w, idx) => (
                <li key={`${w.source || 'warn'}-${idx}`}>
                  {formatSourceLabel(w.source)}
                  {w.source ? '：' : ''}
                  {w.message || '未知錯誤'}
                </li>
              ))}
            </ul>
          </details>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      ) : null}

      <Form onSubmit={handleSearch} className="import-run-history-filters mb-2">
        <div className="import-run-history-filters__section-title">篩選條件</div>
        <Row className="g-2 mb-2">
          <Col md={6} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">資料來源</Form.Label>
              <Form.Select
                size="sm"
                value={draftFilters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
              >
                {IMPORT_RUN_SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all-source'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">匯入類型</Form.Label>
              <Form.Select
                size="sm"
                value={draftFilters.importType}
                onChange={(e) => handleFilterChange('importType', e.target.value)}
              >
                {IMPORT_RUN_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all-type'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">模組</Form.Label>
              <Form.Select
                size="sm"
                value={draftFilters.module}
                onChange={(e) => handleFilterChange('module', e.target.value)}
              >
                {IMPORT_RUN_MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all-module'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">狀態</Form.Label>
              <Form.Select
                size="sm"
                value={draftFilters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                {IMPORT_RUN_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all-status'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        <div className="import-run-history-filters__section-title">時間與關鍵字</div>
        <Row className="g-2 align-items-end">
          <Col md={4} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">開始日期</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={draftFilters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={4} lg={3}>
            <Form.Group>
              <Form.Label className="small mb-1">結束日期</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={draftFilters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={8} lg={4}>
            <Form.Group>
              <Form.Label className="small mb-1">關鍵字</Form.Label>
              <Form.Control
                type="search"
                size="sm"
                placeholder="檔名、操作者、requestId…"
                value={draftFilters.keyword}
                onChange={(e) => handleFilterChange('keyword', e.target.value)}
              />
            </Form.Group>
          </Col>
          <Col md={12} lg={2} className="d-flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={loading} className="flex-grow-1">
              {loading ? '查詢中…' : '查詢'}
            </Button>
            <Button
              type="button"
              variant="outline-secondary"
              size="sm"
              onClick={handleReset}
              disabled={loading}
              className="flex-grow-1"
            >
              重設
            </Button>
          </Col>
        </Row>
      </Form>

      {!error ? (
        <div className="small text-muted mb-3">
          <span className="text-secondary">目前顯示：</span>
          {querySummary}
        </div>
      ) : null}

      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted py-4">
          <Spinner animation="border" size="sm" />
          <span>載入匯入紀錄中…</span>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <Alert variant="light" className="border text-center mb-0 py-4">
          <div className="fw-semibold mb-1">尚無符合條件的匯入紀錄</div>
          <div className="small text-muted mb-0">
            可嘗試清除篩選條件或放寬日期區間
          </div>
        </Alert>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          <div className="import-run-history-cards">
            {items.map((row) => {
              const isDetailLoading = detailLoadingId === row.id;
              const deleteDisabledReason = getDeleteDisabledTooltip(row, accessProfile);
              return (
                <article key={row.id} className="import-run-history-card">
                  <div className="import-run-history-card__header">
                    <div>
                      <div className="import-run-history-card__type">{formatImportTypeLabel(row.importType)}</div>
                      <div className="import-run-history-card__time">{formatDateTime(pickDisplayTime(row))}</div>
                    </div>
                    <StatusBadge variant={importRunStatusToVariant(row.status)} size="md">
                      {formatStatusLabel(row.status)}
                    </StatusBadge>
                  </div>
                  <dl className="import-run-history-card__grid">
                    <dt>模組</dt>
                    <dd>{formatModuleLabel(row.module)}</dd>
                    <dt>成功</dt>
                    <dd>{formatCount(row.successCount)}</dd>
                    <dt>失敗</dt>
                    <dd>{formatCount(row.failedCount)}</dd>
                    <dt>操作者</dt>
                    <dd>{row.executedByUsername || row.executedByUserId || '—'}</dd>
                  </dl>
                  <div className="import-run-history-card__actions">
                    {row.detailAvailable ? (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        disabled={isDetailLoading}
                        onClick={() => openDetail(row)}
                      >
                        {isDetailLoading ? '載入中…' : '查看明細'}
                      </Button>
                    ) : null}
                    {canDeleteAny && canDeleteRow(row) ? (
                      <Button
                        variant="outline-danger"
                        size="sm"
                        disabled={deletingRunId === row.id || loading}
                        onClick={() => handleDeleteRun(row)}
                      >
                        {deletingRunId === row.id ? '刪除中…' : '刪除'}
                      </Button>
                    ) : null}
                    {!row.detailAvailable && (!canDeleteAny || !canDeleteRow(row)) ? (
                      <span className="small text-muted" title={deleteDisabledReason || getNoDetailTooltip(row)}>
                        無可用操作
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <p className="small text-muted mb-2 d-none d-md-block">
            表格欄位較多時可左右捲動；「操作」欄固定於右側，含查看明細與刪除匯入資料。
          </p>
          <div className="import-run-history-table-wrap table-responsive">
            <Table striped hover size="sm" className="mb-0 align-middle import-run-history-table">
              <thead className="table-light">
                <tr>
                  <th>時間</th>
                  <th>匯入類型</th>
                  <th>模組</th>
                  <th>狀態</th>
                  <th style={{ minWidth: '8rem', maxWidth: '14rem' }}>檔案名稱</th>
                  <th className="text-end">成功</th>
                  <th className="text-end">失敗</th>
                  <th className="text-end">略過</th>
                  <th className="text-end">警告</th>
                  <th>操作者</th>
                  <th>來源</th>
                  <th className="text-nowrap import-run-history-table__actions-head">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const isDetailLoading = detailLoadingId === row.id;
                  const deleteDisabledReason = getDeleteDisabledTooltip(row, accessProfile);
                  const showDelete = canDeleteAny;
                  return (
                    <tr key={row.id}>
                      <td className="text-nowrap small">{formatDateTime(pickDisplayTime(row))}</td>
                      <td className="small">{formatImportTypeLabel(row.importType)}</td>
                      <td className="small">{formatModuleLabel(row.module)}</td>
                      <td>
                        <StatusBadge variant={importRunStatusToVariant(row.status)} size="md">
                          {formatStatusLabel(row.status)}
                        </StatusBadge>
                      </td>
                      <td className="small">
                        <span
                          className="d-inline-block text-truncate"
                          style={{ maxWidth: '13rem' }}
                          title={row.fileName || undefined}
                        >
                          {row.fileName || '—'}
                        </span>
                      </td>
                      <td className="text-end small">{formatCount(row.successCount)}</td>
                      <td className="text-end small">{formatCount(row.failedCount)}</td>
                      <td className="text-end small">{formatCount(row.skippedCount)}</td>
                      <td className="text-end small">{formatCount(row.warningCount)}</td>
                      <td className="small text-truncate" style={{ maxWidth: '8rem' }} title={row.executedByUsername || row.executedByUserId || undefined}>
                        {row.executedByUsername || row.executedByUserId || '—'}
                      </td>
                      <td className="small">{formatSourceLabel(row.source)}</td>
                      <td className="small import-run-history-table__actions-cell">
                        <div className="import-run-history-table__actions">
                          {row.detailAvailable ? (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              disabled={isDetailLoading}
                              onClick={() => openDetail(row)}
                            >
                              {isDetailLoading ? '載入中…' : '明細'}
                            </Button>
                          ) : null}
                          {showDelete && canDeleteRow(row) ? (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              disabled={deletingRunId === row.id || loading}
                              onClick={() => handleDeleteRun(row)}
                            >
                              {deletingRunId === row.id ? '刪除中…' : '刪除'}
                            </Button>
                          ) : null}
                          {!row.detailAvailable && !(showDelete && canDeleteRow(row)) ? (
                            <span
                              className="text-muted"
                              title={deleteDisabledReason || getNoDetailTooltip(row)}
                              style={{ cursor: 'help' }}
                            >
                              —
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <div className="import-run-history-pagination d-flex flex-wrap justify-content-between align-items-center gap-2 small text-muted mt-2">
            <span>
              顯示 {pagination.returned} 筆（約 {pagination.totalApprox} 筆符合條件；第{' '}
              {Math.floor(parseOffset(appliedFilters.offset) / parseLimit(appliedFilters.limit)) + 1}{' '}
              頁，每頁 {pagination.limit} 筆）
            </span>
            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canGoPrev || loading}
                onClick={() => handlePage('prev')}
              >
                上一頁
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                disabled={!canGoNext || loading}
                onClick={() => handlePage('next')}
              >
                下一頁
              </Button>
            </div>
          </div>
        </>
      ) : null}

      <Offcanvas placement="end" show={detailOpen} onHide={closeDetail} scroll backdrop>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="d-flex flex-wrap align-items-center gap-2">
            {drawerTitleRow ? (
              <>
                <span>{formatImportTypeLabel(drawerTitleRow.importType)}</span>
                <StatusBadge variant={importRunStatusToVariant(drawerTitleRow.status)} size="md">
                  {formatStatusLabel(drawerTitleRow.status)}
                </StatusBadge>
              </>
            ) : (
              '匯入明細'
            )}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {detailLoading ? (
            <div className="d-flex align-items-center gap-2 text-muted py-2">
              <Spinner animation="border" size="sm" />
              <span>載入明細中…</span>
            </div>
          ) : null}

          {detailError ? (
            <Alert variant="danger" className="py-2 small mb-3">
              {detailError}
            </Alert>
          ) : null}

          {!detailLoading && !detailError && !detailRow && detailOpen ? (
            <Alert variant="secondary" className="py-2 small">
              無明細資料。
            </Alert>
          ) : null}

          {!detailLoading && detailRow ? (
            <>
              {detailRow.source === 'audit_log' ? (
                <Alert variant="warning" className="py-2 small mb-3">
                  此筆來自<strong>稽核摘要</strong>，僅保留操作紀錄，沒有完整匯入明細（統計與錯誤列可能不完整）。
                </Alert>
              ) : null}

              <DetailSection title="基本資訊">
                <div className="small">模組：{formatModuleLabel(detailRow.module)}</div>
                <div className="small">來源：{formatSourceLabel(detailRow.source)}</div>
                <div className="small">
                  檔名：
                  <span className="text-break">{detailRow.fileName || '—'}</span>
                </div>
                <div className="small">
                  操作者：{detailRow.executedByUsername || detailRow.executedByUserId || '—'}
                </div>
                {detailRow.summary ? (
                  <div className="small text-muted mt-2">{detailRow.summary}</div>
                ) : null}
              </DetailSection>

              <DetailSection title="時間">
                <div className="small">顯示時間：{formatDateTime(detailTime)}</div>
                <div className="small text-muted">
                  開始：{formatDateTime(detailRow.startedAt)} · 結束：{formatDateTime(detailRow.finishedAt)} · 建立：{formatDateTime(detailRow.createdAt)}
                </div>
              </DetailSection>

              <DetailSection title="統計">
                <div className="d-flex flex-wrap gap-3 small">
                  <span>總計：{formatCount(detailRow.totalCount)}</span>
                  <span>成功：{formatCount(detailRow.successCount)}</span>
                  <span>失敗：{formatCount(detailRow.failedCount)}</span>
                  <span>略過：{formatCount(detailRow.skippedCount)}</span>
                  <span>警告：{formatCount(detailRow.warningCount)}</span>
                </div>
              </DetailSection>

              {canDeleteAny && drawerTitleRow ? (
                <DetailSection title="危險操作">
                  {canDeleteRow(drawerTitleRow) ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={deletingRunId === drawerTitleRow.id}
                      onClick={() => handleDeleteRun(drawerTitleRow)}
                    >
                      {deletingRunId === drawerTitleRow.id ? '刪除中…' : '刪除此批匯入資料'}
                    </Button>
                  ) : (
                    <div className="small text-muted">
                      {getDeleteDisabledTooltip(drawerTitleRow, accessProfile) || '此紀錄不支援刪除'}
                    </div>
                  )}
                </DetailSection>
              ) : null}

              <DetailSection title="明細資料">
                <Accordion flush>
                  <Accordion.Item eventKey="warnings">
                    <Accordion.Header className="small">
                      警告（{detailRow.warnings?.length || 0}）
                    </Accordion.Header>
                    <Accordion.Body className="pt-2">
                      {detailRow.warnings?.length ? (
                        <pre
                          className="small bg-light border rounded p-2 mb-0"
                          style={{ whiteSpace: 'pre-wrap', maxHeight: '12rem', overflow: 'auto' }}
                        >
                          {JSON.stringify(detailRow.warnings, null, 2)}
                        </pre>
                      ) : (
                        <div className="small text-muted">—</div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="errors">
                    <Accordion.Header className="small">
                      錯誤（{detailRow.errors?.length || 0}）
                    </Accordion.Header>
                    <Accordion.Body className="pt-2">
                      {detailRow.errors?.length ? (
                        <pre
                          className="small bg-light border rounded p-2 mb-0"
                          style={{ whiteSpace: 'pre-wrap', maxHeight: '12rem', overflow: 'auto' }}
                        >
                          {JSON.stringify(detailRow.errors, null, 2)}
                        </pre>
                      ) : (
                        <div className="small text-muted">—</div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="skipped">
                    <Accordion.Header className="small">
                      略過（{detailRow.skippedDetails?.length || 0}）
                    </Accordion.Header>
                    <Accordion.Body className="pt-2">
                      {detailRow.skippedDetails?.length ? (
                        <pre
                          className="small bg-light border rounded p-2 mb-0"
                          style={{ whiteSpace: 'pre-wrap', maxHeight: '12rem', overflow: 'auto' }}
                        >
                          {JSON.stringify(detailRow.skippedDetails, null, 2)}
                        </pre>
                      ) : (
                        <div className="small text-muted">—</div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="conflicts">
                    <Accordion.Header className="small">
                      衝突（{detailRow.conflicts?.length || 0}）
                    </Accordion.Header>
                    <Accordion.Body className="pt-2">
                      {detailRow.conflicts?.length ? (
                        <pre
                          className="small bg-light border rounded p-2 mb-0"
                          style={{ whiteSpace: 'pre-wrap', maxHeight: '12rem', overflow: 'auto' }}
                        >
                          {JSON.stringify(detailRow.conflicts, null, 2)}
                        </pre>
                      ) : (
                        <div className="small text-muted">—</div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
                  <Accordion.Item eventKey="raw">
                    <Accordion.Header className="small text-muted">原始資料（rawSource）</Accordion.Header>
                    <Accordion.Body className="pt-2">
                      <pre
                        className="small bg-light border rounded p-2 mb-0"
                        style={{ whiteSpace: 'pre-wrap', maxHeight: '14rem', overflow: 'auto' }}
                      >
                        {JSON.stringify(detailRow.rawSource || {}, null, 2)}
                      </pre>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              </DetailSection>
            </>
          ) : null}
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
}
