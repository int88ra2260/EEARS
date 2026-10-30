import React, { useCallback, useEffect, useId, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { Button, Form, Modal } from 'react-bootstrap';
import {
  fetchAuditDetail,
  fetchAuditLogs,
  fetchEmailLogs,
  fetchLogMetricsSummary,
  fetchLogsByRequestId,
  fetchSystemLogs,
} from '../../services/auditAdminApi';
import {
  ACCOUNT_SECURITY_PRESETS,
  LOG_TYPES,
  actionLabel,
  addDaysToDateInput,
  buildListParams,
  buildRequestTimeline,
  createLogFilters,
  describeAppliedFilters,
  durationTone,
  filtersEqual,
  filterFieldCopy,
  formatChangedFields,
  formatDuration,
  formatEntity,
  formatLogTime,
  formatPerson,
  moduleLabel,
  formatRelated,
  methodTone,
  pageRangeLabel,
  pageWindow,
  requestGapLabels,
  shortRequestId,
  statusLabel,
  statusTone,
  taipeiDateInputValue,
} from './auditLogsUi';
import './AdminAuditLogsPage.css';

const PAGE_SIZES = [20, 50, 100];
const AUDIT_STATUSES = [
  { value: '', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失敗' },
];
const EMAIL_STATUSES = [
  { value: '', label: '全部' },
  { value: 'success', label: '寄出了' },
  { value: 'failed', label: '沒寄成' },
  { value: 'retry', label: '還在重試' },
];

function TimeStamp({ iso, requestId }) {
  const { clock, relative } = formatLogTime(iso);
  return (
    <div className="audit-logs__time">
      <time dateTime={iso || undefined}>{clock}</time>
      {relative ? <span className="audit-logs__relative">{relative}</span> : null}
      {requestId ? (
        <>
          <code className="audit-logs__rid" aria-hidden="true">{shortRequestId(requestId)}</code>
          <span className="visually-hidden">請求編號 {requestId}</span>
        </>
      ) : null}
    </div>
  );
}

function StatusPill({ status }) {
  const tone = statusTone(status);
  return <span className={`audit-logs__pill audit-logs__pill--${tone}`}>{statusLabel(status)}</span>;
}

function MethodMark({ method }) {
  const tone = methodTone(method);
  return <span className={`audit-logs__method audit-logs__method--${tone}`}>{method || '—'}</span>;
}

function CopyButton({ value, onCopy, children }) {
  if (!value) return null;
  return (
    <Button type="button" variant="link" className="audit-logs__text-btn" onClick={() => onCopy(value)}>
      {children || '複製'}
    </Button>
  );
}

function ChangePayload({ data }) {
  const fields = formatChangedFields(data?.changedFields);
  const hasBefore = data?.beforeData != null;
  const hasAfter = data?.afterData != null;
  if (!fields.length && !hasBefore && !hasAfter && !data?.changeReason) {
    return <p className="audit-logs__meta mb-0">這筆紀錄沒有留下變更內容。</p>;
  }
  return (
    <>
      {data?.changeReason ? (
        <div className="audit-logs__span">
          <div className="audit-logs__meta">變更原因</div>
          <div>{data.changeReason}</div>
        </div>
      ) : null}
      {fields.length ? (
        <div className="audit-logs__span">
          <div className="audit-logs__meta">變更欄位</div>
          <ul className="audit-logs__chips">
            {fields.map((field) => (
              <li key={field}><span className="audit-logs__pill">{field}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
      {(hasBefore || hasAfter) ? (
        <div className="audit-logs__json audit-logs__span">
          <div>
            <h3>變更前</h3>
            <pre>{hasBefore ? JSON.stringify(data.beforeData, null, 2) : '無'}</pre>
          </div>
          <div>
            <h3>變更後</h3>
            <pre>{hasAfter ? JSON.stringify(data.afterData, null, 2) : '無'}</pre>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RowDetails({ logType, row, detail, onCopy, onOpenRequest, onRetryDetail }) {
  const fullSummary = logType === 'email' ? row.subject : row.targetSummary;
  return (
    <tr className="audit-logs__detail">
      <td colSpan={5}>
        <dl className="audit-logs__dl">
          <div>
            <dt>同一次操作的編號</dt>
            <dd>
              {row.requestId ? <code className="audit-logs__mono">{row.requestId}</code> : '沒有編號'}
              {' '}
              <CopyButton value={row.requestId} onCopy={onCopy} />
              {row.requestId ? (
                <Button type="button" variant="link" className="audit-logs__text-btn" onClick={() => onOpenRequest(row.requestId)}>
                  一起看這次還發生什麼
                </Button>
              ) : null}
            </dd>
          </div>
          <div>
            <dt>從哪裡來</dt>
            <dd>{row.ipAddress || '沒有網路位址'}{row.userAgent ? ` · ${row.userAgent}` : ''}</dd>
          </div>
          {logType === 'audit' ? (
            <div>
              <dt>對象</dt>
              <dd>{formatEntity(row.entityType, row.entityId) || '沒有對象'}</dd>
            </div>
          ) : null}
          {logType === 'system' ? (
            <div>
              <dt>怎麼呼叫、等了多久</dt>
              <dd>{row.type && row.type !== 'http' ? row.type : '一般網頁呼叫'} · {formatDuration(row.durationMs)}</dd>
            </div>
          ) : null}
          {logType === 'email' ? (
            <div>
              <dt>關聯</dt>
              <dd>{formatRelated(row.relatedEntityType, row.relatedEntityId)}</dd>
            </div>
          ) : null}
          {fullSummary ? (
            <div className="audit-logs__span">
              <dt>{logType === 'email' ? '主旨' : '當時留下的說明'}</dt>
              <dd>{fullSummary}</dd>
            </div>
          ) : null}
          {row.errorMessage ? (
            <div className="audit-logs__span">
              <dt>錯誤</dt>
              <dd className="audit-logs__error">{row.errorMessage}</dd>
            </div>
          ) : null}
          {logType === 'system' && row.path ? (
            <div className="audit-logs__span">
              <dt>完整網址</dt>
              <dd><code className="audit-logs__mono">{row.path}</code></dd>
            </div>
          ) : null}
          {logType === 'audit' ? (
            <div className="audit-logs__span">
              <dt>變更內容</dt>
              <dd>
                {detail?.status === 'loading' ? <span className="audit-logs__meta">正在讀取變更內容…</span> : null}
                {detail?.status === 'error' ? (
                  <>
                    <span>{detail.error}</span>
                    {' '}
                    <Button type="button" variant="link" className="audit-logs__text-btn" onClick={onRetryDetail}>
                      再試一次
                    </Button>
                  </>
                ) : null}
                {detail?.status === 'ready' ? <ChangePayload data={detail.data} /> : null}
                {detail?.status === 'ready' && detail.data?.userAgent ? (
                  <p className="audit-logs__meta mb-0 mt-2">瀏覽器 {detail.data.userAgent}</p>
                ) : null}
              </dd>
            </div>
          ) : null}
        </dl>
      </td>
    </tr>
  );
}

function LogRow({ logType, row, expanded, detail, onToggle, onCopy, onOpenRequest, onRetryDetail }) {
  const tone = statusTone(row.status);
  let rowClass = '';
  if (tone === 'bad') rowClass = 'audit-logs__row--bad';
  else if (tone === 'warn') rowClass = 'audit-logs__row--warn';
  return (
    <>
      <tr className={rowClass}>
        <td><TimeStamp iso={row.createdAt} requestId={row.requestId} /></td>
        <td>{renderStory(logType, row)}</td>
        <td>{renderWho(logType, row)}</td>
        <td><StatusPill status={row.status} /></td>
        <td>
          <div className="audit-logs__row-actions">
            <Button
              type="button"
              variant="link"
              className="audit-logs__text-btn"
              aria-expanded={expanded}
              onClick={onToggle}
            >
              {expanded ? '收起' : '展開'}
            </Button>
            {row.requestId ? (
              <Button type="button" variant="link" className="audit-logs__text-btn" onClick={() => onOpenRequest(row.requestId)}>
                同一次操作
              </Button>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <RowDetails
          logType={logType}
          row={row}
          detail={detail}
          onCopy={onCopy}
          onOpenRequest={onOpenRequest}
          onRetryDetail={onRetryDetail}
        />
      ) : null}
    </>
  );
}

function renderStory(logType, row) {
  if (logType === 'system') {
    const slow = durationTone(row.durationMs);
    return (
      <div className="audit-logs__what">
        <div className="audit-logs__headline">
          <MethodMark method={row.method} />
          {row.type && row.type !== 'http' ? <span className="audit-logs__module">{row.type}</span> : null}
        </div>
        <p className="audit-logs__path" title={row.path || ''}>{row.path || '沒有路徑'}</p>
        <p className={`audit-logs__meta audit-logs__duration--${slow}`}>{formatDuration(row.durationMs)}</p>
        {row.errorMessage ? <p className="audit-logs__error" title={row.errorMessage}>{row.errorMessage}</p> : null}
      </div>
    );
  }
  if (logType === 'email') {
    return (
      <div className="audit-logs__what">
        <div className="audit-logs__headline">
          <span className="audit-logs__module">{row.template || '未命名範本'}</span>
        </div>
        {row.subject ? <p className="audit-logs__subject" title={row.subject}>{row.subject}</p> : null}
        {row.errorMessage ? <p className="audit-logs__error" title={row.errorMessage}>{row.errorMessage}</p> : null}
      </div>
    );
  }
  const label = actionLabel(row.action);
  const entity = formatEntity(row.entityType, row.entityId);
  return (
    <div className="audit-logs__what">
      <div className="audit-logs__headline">
        {row.module ? <span className="audit-logs__module" title={row.module}>{moduleLabel(row.module)}</span> : null}
        <span className="audit-logs__action-name">{label}</span>
      </div>
      {label !== row.action && row.action ? <div className="audit-logs__action-code">{row.action}</div> : null}
      {row.targetSummary ? <p className="audit-logs__summary" title={row.targetSummary}>{row.targetSummary}</p> : null}
      {entity || row.ipAddress ? (
        <p className="audit-logs__meta">{[entity, row.ipAddress ? `來自 ${row.ipAddress}` : ''].filter(Boolean).join(' · ')}</p>
      ) : null}
      {row.errorMessage ? <p className="audit-logs__error" title={row.errorMessage}>{row.errorMessage}</p> : null}
    </div>
  );
}

function renderWho(logType, row) {
  if (logType === 'system') {
    return (
      <div>
        <div>{formatPerson(null, row.role, row.userId)}</div>
        <div className="audit-logs__meta">{row.ipAddress ? `來自 ${row.ipAddress}` : '沒有網路位址'}</div>
      </div>
    );
  }
  if (logType === 'email') {
    return (
      <div>
        <div>{row.to || '沒有收件人'}</div>
        <div className="audit-logs__meta">{formatRelated(row.relatedEntityType, row.relatedEntityId)}</div>
      </div>
    );
  }
  return <div>{formatPerson(row.operatorName, row.operatorRole, row.operatorId)}</div>;
}

function columnLabels(logType) {
  if (logType === 'system') return ['時間', '被打開的網址', '誰、從哪裡', '結果', '再看'];
  if (logType === 'email') return ['時間', '哪一封信', '寄給誰', '結果', '再看'];
  return ['時間', '發生了什麼', '誰做的', '結果', '再看'];
}

function RequestDialog({ show, requestId, logs, onHide, onCopy }) {
  const timeline = logs ? buildRequestTimeline(logs) : [];
  const gaps = logs ? requestGapLabels(logs) : [];
  const httpCount = logs?.systemLogs?.length || 0;
  const auditCount = logs?.auditLogs?.length || 0;
  const emailCount = logs?.emailLogs?.length || 0;
  let gapText = '';
  if (gaps.length === 3) gapText = '這次操作沒有留下網站呼叫、人員操作或寄信。';
  else if (gaps.length) gapText = `這次沒有${gaps.join('、')}。`;

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable animation={false}>
      <Modal.Header closeButton>
        <Modal.Title>同一次操作還發生了什麼</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="audit-logs__request-head">
          <div>
            <div className="audit-logs__meta">這次操作的編號</div>
            <p className="audit-logs__request-id">{requestId || '—'}</p>
            <p className="audit-logs__caption">網站呼叫、人員操作和寄信，依照發生的先後排列。</p>
          </div>
          <Button type="button" variant="outline-secondary" size="sm" onClick={() => onCopy(requestId)}>
            複製編號
          </Button>
        </div>
        {!logs ? <p>正在把這次操作的紀錄找出來…</p> : (
          <>
            <p className="audit-logs__summary-line">
              網站呼叫 {httpCount} · 人員操作 {auditCount} · 寄出的信 {emailCount}
            </p>
            {gapText ? <p className="audit-logs__hint">{gapText}</p> : null}
            <ol className="audit-logs__timeline">
              {timeline.map((item) => (
                <li key={item.id} className="audit-logs__event">
                  <TimeStamp iso={item.at} />
                  <TimelineBody item={item} />
                </li>
              ))}
            </ol>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}

function TimelineBody({ item }) {
  const row = item.row;
  if (item.kind === 'http') {
    return (
      <div>
        <div className="audit-logs__headline">
          <span className="audit-logs__pill audit-logs__pill--info">網站呼叫</span>
          <MethodMark method={row.method} />
          <StatusPill status={row.status} />
          <span className={`audit-logs__duration--${durationTone(row.durationMs)}`}>{formatDuration(row.durationMs)}</span>
        </div>
        <p className="audit-logs__path">{row.path || '沒有路徑'}</p>
        <p className="audit-logs__meta">{formatPerson(null, row.role, row.userId)} · {row.ipAddress ? `來自 ${row.ipAddress}` : '沒有網路位址'}</p>
        {row.errorMessage ? <p className="audit-logs__error">{row.errorMessage}</p> : null}
        {row.userAgent ? (
          <details>
            <summary>瀏覽器</summary>
            <p className="audit-logs__mono">{row.userAgent}</p>
          </details>
        ) : null}
      </div>
    );
  }
  if (item.kind === 'email') {
    return (
      <div>
        <div className="audit-logs__headline">
          <span className="audit-logs__pill audit-logs__pill--info">寄信</span>
          <span className="audit-logs__module">{row.template || '未命名範本'}</span>
          <StatusPill status={row.status} />
        </div>
        <p className="audit-logs__subject">{row.subject || '沒有主旨'}</p>
        <p className="audit-logs__meta">{row.to || '沒有收件人'} · {formatRelated(row.relatedEntityType, row.relatedEntityId)}</p>
        {row.errorMessage ? <p className="audit-logs__error">{row.errorMessage}</p> : null}
      </div>
    );
  }
  return (
    <div>
      <div className="audit-logs__headline">
        <span className="audit-logs__pill audit-logs__pill--info">人員操作</span>
        {row.module ? <span className="audit-logs__module" title={row.module}>{moduleLabel(row.module)}</span> : null}
        <span className="audit-logs__action-name">{actionLabel(row.action)}</span>
        <StatusPill status={row.status} />
      </div>
      <p className="audit-logs__meta">{formatPerson(row.operatorName, row.operatorRole, row.operatorId)}</p>
      {row.targetSummary ? <p className="audit-logs__summary">{row.targetSummary}</p> : null}
      {row.errorMessage ? <p className="audit-logs__error">{row.errorMessage}</p> : null}
      <details>
        <summary>變更內容</summary>
        <ChangePayload data={row} />
      </details>
    </div>
  );
}

export default function AdminAuditLogsPage() {
  const { token } = useOutletContext();
  const location = useLocation();
  const uid = useId();
  const [logType, setLogType] = useState('audit');
  const [draft, setDraft] = useState(() => createLogFilters());
  const [applied, setApplied] = useState(() => createLogFilters());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [reloadKey, setReloadKey] = useState(0);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loadedType, setLoadedType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [metricsState, setMetricsState] = useState('loading');
  const [manualRequestId, setManualRequestId] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestIdViewing, setRequestIdViewing] = useState('');
  const [requestLogs, setRequestLogs] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [detailById, setDetailById] = useState({});

  const copy = filterFieldCopy(logType);
  const activeType = LOG_TYPES.find((item) => item.id === logType) || LOG_TYPES[0];
  const appliedParts = describeAppliedFilters(logType, applied);
  const dirty = !filtersEqual(draft, applied);
  const showSkeleton = loading && loadedType !== logType;
  const totalPages = pagination.totalPages || 1;

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setMetricsState('loading');
    fetchLogMetricsSummary(token)
      .then((data) => {
        if (cancelled) return;
        setMetrics(data.metrics || null);
        setMetricsState(data.metrics ? 'ready' : 'error');
      })
      .catch(() => {
        if (cancelled) return;
        setMetrics(null);
        setMetricsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    const params = buildListParams(logType, applied, page, limit);
    let load = fetchAuditLogs;
    if (logType === 'system') load = fetchSystemLogs;
    if (logType === 'email') load = fetchEmailLogs;
    load(token, params)
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        setLoadedType(logType);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError.message || '載入失敗');
        setItems([]);
        setLoadedType(logType);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logType, applied, page, limit, reloadKey]);

  const copyText = useCallback(async (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice('已複製');
      setError('');
    } catch {
      setError('無法複製，請手動選取文字');
    }
  }, []);

  const openRequest = useCallback(async (rid) => {
    const id = String(rid || '').trim();
    if (!id) {
      setError('請貼上同一次操作的編號');
      return;
    }
    setError('');
    setRequestIdViewing(id);
    setRequestLogs(null);
    setRequestOpen(true);
    try {
      const data = await fetchLogsByRequestId(token, id);
      setRequestLogs(data);
    } catch (loadError) {
      setRequestOpen(false);
      setError(loadError.message || '載入請求紀錄失敗');
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const rid = new URLSearchParams(location.search).get('requestId');
    if (!rid) return;
    setManualRequestId(rid);
    openRequest(rid);
  }, [token, location.search, openRequest]);

  const loadDetail = useCallback(async (id) => {
    setDetailById((prev) => ({ ...prev, [id]: { status: 'loading' } }));
    try {
      const data = await fetchAuditDetail(token, id);
      setDetailById((prev) => ({ ...prev, [id]: { status: 'ready', data } }));
    } catch (loadError) {
      setDetailById((prev) => ({
        ...prev,
        [id]: { status: 'error', error: loadError.message || '無法讀取變更內容' },
      }));
    }
  }, [token]);

  function commitFilters(next, nextPage = 1) {
    const normalized = createLogFilters(next);
    setDraft(normalized);
    setApplied(normalized);
    setPage(nextPage);
    setExpandedIds(new Set());
  }

  function switchType(nextType) {
    if (nextType === logType) return;
    const next = createLogFilters({
      keyword: draft.keyword,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      operatorId: draft.operatorId,
    });
    setLogType(nextType);
    setDetailById({});
    commitFilters(next);
  }

  function openFromMetric(nextType, partial) {
    setLogType(nextType);
    setDetailById({});
    commitFilters(createLogFilters(partial));
  }

  function applyDates(dateFrom, dateTo) {
    setDraft((current) => createLogFilters({ ...current, dateFrom, dateTo }));
    setApplied((current) => createLogFilters({ ...current, dateFrom, dateTo }));
    setPage(1);
    setExpandedIds(new Set());
  }

  function toggleRow(row) {
    const key = `${logType}-${row.id}`;
    const willOpen = !expandedIds.has(key);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    const detail = detailById[row.id];
    if (willOpen && logType === 'audit' && detail?.status !== 'ready' && detail?.status !== 'loading') {
      loadDetail(row.id);
    }
  }

  const today = taipeiDateInputValue();
  const emailTotal = metrics
    ? (metrics.email?.success || 0) + (metrics.email?.failed || 0) + (metrics.email?.retry || 0)
    : 0;
  const headers = columnLabels(loadedType || logType);

  return (
    <div className="audit-logs">
      <p className="audit-logs__lead">
        先看過去一天有沒有出錯。接著選擇要看人員做了什麼、網站怎麼被呼叫，或寄出的信。同一筆事情可以再打開，把相關紀錄放在一起。
      </p>

      {notice ? <div className="alert alert-success py-2" role="status">{notice}</div> : null}
      {error ? <div className="alert alert-warning py-2" role="alert">{error}</div> : null}

      {metricsState === 'error' ? (
        <p className="audit-logs__caption">過去一天的數字暫時讀不到，下面的清單還是可以查。</p>
      ) : null}
      {metrics ? (
        <section className="audit-logs__band" aria-labelledby={`${uid}-day`}>
          <h3 id={`${uid}-day`} className="audit-logs__band-title">過去一天</h3>
          <div className="audit-logs__kpis">
            <button type="button" className="audit-logs__kpi" onClick={() => openFromMetric('system')}>
              <span className="audit-logs__kpi-label">網站被呼叫</span>
              <span className="audit-logs__kpi-value">{Number(metrics.requestCount24h || 0).toLocaleString('zh-TW')}</span>
              <span className="audit-logs__kpi-sub">打開全部網站呼叫</span>
            </button>
            <button
              type="button"
              className={`audit-logs__kpi${metrics.fiveXxCount24h > 0 ? ' audit-logs__kpi--alert' : ''}`}
              onClick={() => openFromMetric('system', { onlyServerErrors: true })}
            >
              <span className="audit-logs__kpi-label">伺服器出錯</span>
              <span className="audit-logs__kpi-value">{Number(metrics.fiveXxCount24h || 0).toLocaleString('zh-TW')}</span>
              <span className="audit-logs__kpi-sub">列出所有時間的伺服器錯誤</span>
            </button>
            <button type="button" className="audit-logs__kpi" onClick={() => openFromMetric('audit')}>
              <span className="audit-logs__kpi-label">人員操作</span>
              <span className="audit-logs__kpi-value">{Number(metrics.auditCount24h || 0).toLocaleString('zh-TW')}</span>
              <span className="audit-logs__kpi-sub">打開人員做了什麼</span>
            </button>
            <button
              type="button"
              className={`audit-logs__kpi${metrics.email?.failed > 0 ? ' audit-logs__kpi--alert' : ''}`}
              onClick={() => openFromMetric('email', metrics.email?.failed > 0 ? { status: 'failed' } : {})}
            >
              <span className="audit-logs__kpi-label">寄出的信</span>
              <span className="audit-logs__kpi-value">{emailTotal.toLocaleString('zh-TW')}</span>
              <span className="audit-logs__kpi-sub">
                寄出 {metrics.email?.success || 0} · 沒寄成 {metrics.email?.failed || 0} · 還在重試 {metrics.email?.retry || 0}
                {metrics.email?.failed > 0 ? ' · 改看沒寄成的信' : ''}
              </span>
            </button>
            <div className="audit-logs__kpi">
              <span className="audit-logs__kpi-label">平均要等多久</span>
              <span className="audit-logs__kpi-value">{formatDuration(metrics.avgRequestDurationMs24h)}</span>
              <span className="audit-logs__kpi-sub">過去一天的網站呼叫</span>
            </div>
          </div>
          <p className="audit-logs__caption">
            這些數字只算過去 24 小時。點「伺服器出錯」會列出所有時間的伺服器錯誤；有信沒寄成時，會打開所有時間沒寄成的信。
          </p>
        </section>
      ) : null}

      <h3 className="audit-logs__band-title">要看哪一種</h3>
      <div className="audit-logs__tabs" role="tablist" aria-label="要看哪一種紀錄">
        {LOG_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            role="tab"
            id={`${uid}-tab-${type.id}`}
            aria-selected={logType === type.id}
            aria-controls={`${uid}-panel`}
            className="audit-logs__tab"
            onClick={() => switchType(type.id)}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${logType}`} aria-busy={loading}>
        <p className="audit-logs__hint">{activeType.hint}</p>

        <div className="audit-logs__card">
          <h3 className="audit-logs__band-title">縮小範圍</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              commitFilters(draft);
            }}
          >
            <div className="audit-logs__group">
              <h4 className="audit-logs__group-title">時間</h4>
              <div className="audit-logs__group-body">
                <div className="audit-logs__field audit-logs__field--wide">
                  <div className="audit-logs__dates">
                    <Button type="button" size="sm" variant="outline-secondary" onClick={() => applyDates(today, today)}>今天</Button>
                    <Button type="button" size="sm" variant="outline-secondary" onClick={() => applyDates(addDaysToDateInput(today, -6), today)}>近 7 天</Button>
                    <Button type="button" size="sm" variant="outline-secondary" onClick={() => applyDates(addDaysToDateInput(today, -29), today)}>近 30 天</Button>
                    <Button type="button" size="sm" variant="outline-secondary" onClick={() => applyDates('', '')}>全部時間</Button>
                    <Form.Control
                      size="sm"
                      type="date"
                      aria-label="開始日期"
                      value={draft.dateFrom}
                      onChange={(event) => setDraft((current) => createLogFilters({ ...current, dateFrom: event.target.value }))}
                    />
                    <span className="audit-logs__date-sep">到</span>
                    <Form.Control
                      size="sm"
                      type="date"
                      aria-label="結束日期"
                      value={draft.dateTo}
                      onChange={(event) => setDraft((current) => createLogFilters({ ...current, dateTo: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="audit-logs__group">
              <h4 className="audit-logs__group-title">內容</h4>
              <div className="audit-logs__group-body">
                <div className="audit-logs__field audit-logs__field--wide">
                  <label htmlFor={`${uid}-keyword`}>關鍵字</label>
                  <Form.Control
                    id={`${uid}-keyword`}
                    size="sm"
                    value={draft.keyword}
                    placeholder={copy.keywordPlaceholder}
                    onChange={(event) => setDraft((current) => createLogFilters({ ...current, keyword: event.target.value }))}
                  />
                </div>
                <div className="audit-logs__field">
                  <label htmlFor={`${uid}-module`}>{copy.moduleLabel}</label>
                  <Form.Control
                    id={`${uid}-module`}
                    size="sm"
                    value={draft.moduleName}
                    placeholder={copy.modulePlaceholder}
                    onChange={(event) => setDraft((current) => createLogFilters({ ...current, moduleName: event.target.value }))}
                  />
                </div>
                <div className="audit-logs__field">
                  <label htmlFor={`${uid}-action`}>{copy.actionLabel}</label>
                  <Form.Control
                    id={`${uid}-action`}
                    size="sm"
                    value={draft.action}
                    placeholder={copy.actionPlaceholder}
                    spellCheck={false}
                    onChange={(event) => setDraft((current) => createLogFilters({
                      ...current,
                      action: event.target.value,
                      actionMatchExact: false,
                    }))}
                  />
                  {logType === 'audit' ? (
                    <Form.Check
                      className="audit-logs__check"
                      type="checkbox"
                      id={`${uid}-exact`}
                      label="名稱要完全一樣"
                      checked={draft.actionMatchExact}
                      onChange={(event) => setDraft((current) => createLogFilters({
                        ...current,
                        actionMatchExact: event.target.checked,
                      }))}
                    />
                  ) : null}
                  <p className="audit-logs__field-help">{copy.actionHelp}</p>
                </div>
              </div>
            </div>

            <div className="audit-logs__group">
              <h4 className="audit-logs__group-title">誰與結果</h4>
              <div className="audit-logs__group-body">
                <div className="audit-logs__field">
                  <label htmlFor={`${uid}-operator`}>{copy.operatorLabel}</label>
                  <Form.Control
                    id={`${uid}-operator`}
                    size="sm"
                    value={draft.operatorId}
                    placeholder={copy.operatorPlaceholder}
                    onChange={(event) => setDraft((current) => createLogFilters({ ...current, operatorId: event.target.value }))}
                  />
                </div>
                <div className="audit-logs__field">
                  <label htmlFor={`${uid}-status`}>{copy.statusLabel}</label>
                  {logType === 'system' ? (
                    <Form.Control
                      id={`${uid}-status`}
                      size="sm"
                      inputMode="numeric"
                      value={draft.status}
                      placeholder={copy.statusPlaceholder}
                      onChange={(event) => setDraft((current) => createLogFilters({
                        ...current,
                        status: event.target.value,
                        onlyServerErrors: false,
                      }))}
                    />
                  ) : (
                    <Form.Select
                      id={`${uid}-status`}
                      size="sm"
                      value={draft.status}
                      onChange={(event) => setDraft((current) => createLogFilters({ ...current, status: event.target.value }))}
                    >
                      {(logType === 'email' ? EMAIL_STATUSES : AUDIT_STATUSES).map((option) => (
                        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                      ))}
                    </Form.Select>
                  )}
                  {logType === 'system' ? (
                    <Form.Check
                      className="audit-logs__check"
                      type="checkbox"
                      id={`${uid}-5xx`}
                      label="只看伺服器出錯"
                      checked={draft.onlyServerErrors}
                      onChange={(event) => setDraft((current) => createLogFilters({
                        ...current,
                        onlyServerErrors: event.target.checked,
                        status: event.target.checked ? '' : current.status,
                      }))}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="audit-logs__actions">
              <Button type="submit" size="sm" variant="primary">查找</Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={() => commitFilters(createLogFilters())}>
                清除條件
              </Button>
              <Button type="button" size="sm" variant="outline-secondary" onClick={() => setReloadKey((value) => value + 1)}>
                重新整理
              </Button>
              {dirty ? <span className="audit-logs__dirty">條件改了，按查找才會更新清單</span> : null}
            </div>
          </form>

          <form
            className="audit-logs__group"
            onSubmit={(event) => {
              event.preventDefault();
              openRequest(manualRequestId);
            }}
          >
            <h4 className="audit-logs__group-title">同一次操作</h4>
            <div className="audit-logs__group-body">
              <div className="audit-logs__field audit-logs__field--wide">
                <label htmlFor={`${uid}-request`}>錯誤頁上的那串編號</label>
                <div className="audit-logs__lookup-row">
                  <Form.Control
                    id={`${uid}-request`}
                    size="sm"
                    value={manualRequestId}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="貼上編號，把網站呼叫、人員操作和寄信放在一起"
                    onChange={(event) => setManualRequestId(event.target.value)}
                  />
                  <Button type="submit" size="sm" variant="outline-secondary">找齊這一次</Button>
                </div>
              </div>
            </div>
          </form>

          {logType === 'audit' ? (
            <div className="audit-logs__group">
              <h4 className="audit-logs__group-title">帳號</h4>
              <div>
                <p className="audit-logs__field-help">點一下就只找這一種，名稱要完全一樣。</p>
                {['帳號進出', '帳號異動'].map((group) => (
                  <div key={group} className="audit-logs__preset-block">
                    <div className="audit-logs__preset-group">{group}</div>
                    <div className="audit-logs__presets">
                      {ACCOUNT_SECURITY_PRESETS.filter((preset) => preset.group === group).map((preset) => {
                        const active = applied.action === preset.code && applied.actionMatchExact;
                        return (
                          <button
                            key={preset.code}
                            type="button"
                            className={`audit-logs__preset${active ? ' audit-logs__preset--active' : ''}`}
                            aria-pressed={active}
                            title={preset.code}
                            onClick={() => commitFilters({ ...draft, action: preset.code, actionMatchExact: true })}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="audit-logs__summary-line">
          {appliedParts.length ? `現在看的是：${appliedParts.join('、')}` : '還沒縮小範圍，顯示全部時間、最新的紀錄。'}
        </p>

        <div className="audit-logs__toolbar">
          <div aria-live="polite">
            {loading && loadedType !== logType ? '正在載入紀錄…' : (
              <>
                {pageRangeLabel(page, limit, pagination.total || 0)}
                <span className="audit-logs__toolbar-note"> · 由新到舊</span>
              </>
            )}
          </div>
          <label className="audit-logs__limit">
            每頁
            <Form.Select
              size="sm"
              aria-label="每頁筆數"
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
                setExpandedIds(new Set());
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </Form.Select>
          </label>
        </div>

        {showSkeleton ? (
          <div className="audit-logs__card audit-logs__skeleton" aria-hidden="true">
            {['100%', '92%', '96%', '88%', '94%', '90%'].map((width) => (
              <div key={width} className="audit-logs__skel" style={{ width }} />
            ))}
          </div>
        ) : null}

        {!showSkeleton && !error && items.length === 0 ? (
          <div className="audit-logs__empty">
            {appliedParts.length
              ? '沒有符合目前條件的紀錄。可以放寬日期或清除條件後再看。'
              : `目前沒有${activeType.label}。`}
          </div>
        ) : null}

        {!showSkeleton && items.length > 0 ? (
          <div className={`audit-logs__table-wrap${loading ? ' audit-logs__table-wrap--busy' : ''}`}>
            <table className="audit-logs__table">
              <caption className="visually-hidden">{activeType.label}清單</caption>
              <thead>
                <tr>
                  {headers.map((header) => <th key={header} scope="col">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const key = `${logType}-${row.id}`;
                  return (
                    <LogRow
                      key={key}
                      logType={logType}
                      row={row}
                      expanded={expandedIds.has(key)}
                      detail={detailById[row.id]}
                      onToggle={() => toggleRow(row)}
                      onCopy={copyText}
                      onOpenRequest={openRequest}
                      onRetryDetail={() => loadDetail(row.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <nav className="audit-logs__pager" aria-label="分頁">
            <button type="button" className="audit-logs__page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              上一頁
            </button>
            {pageWindow(page, totalPages).map((item) => (
              typeof item === 'number' ? (
                <button
                  key={item}
                  type="button"
                  className={`audit-logs__page${item === page ? ' audit-logs__page--current' : ''}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ) : (
                <span key={item} aria-hidden="true">…</span>
              )
            ))}
            <button
              type="button"
              className="audit-logs__page"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              下一頁
            </button>
          </nav>
        ) : null}
      </div>

      <RequestDialog
        show={requestOpen}
        requestId={requestIdViewing}
        logs={requestLogs}
        onHide={() => setRequestOpen(false)}
        onCopy={copyText}
      />
    </div>
  );
}
