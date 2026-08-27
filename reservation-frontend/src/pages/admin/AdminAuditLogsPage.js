import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { Button, Modal, Pagination, Table, Form } from 'react-bootstrap';
import {
  fetchAuditLogs,
  fetchEmailLogs,
  fetchLogMetricsSummary,
  fetchLogsByRequestId,
  fetchSystemLogs,
} from '../../services/auditAdminApi';

function buildParams(params) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') out[k] = v;
  });
  return out;
}

const ACCOUNT_SECURITY_ACTION_PRESETS = [
  'login_success',
  'login_failure',
  'access_profile_stale',
  'account_disabled_access_attempt',
  'permission_denied',
  'account_created',
  'account_updated',
  'account_enabled',
  'account_disabled',
  'account_password_reset',
  'account_password_changed',
  'permission_override_changed',
];

export default function AdminAuditLogsPage() {
  const { token } = useOutletContext();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [toast, setToast] = useState('');

  const [page, setPage] = useState(1);
  const [moduleName, setModuleName] = useState('');
  const [action, setAction] = useState('');
  const [actionMatchExact, setActionMatchExact] = useState(false);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [manualRequestId, setManualRequestId] = useState('');

  const [logType, setLogType] = useState('audit'); // audit | system | email

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestLogs, setRequestLogs] = useState(null);
  const [requestIdViewing, setRequestIdViewing] = useState('');

  const limit = 20;

  const load = useCallback(
    async (pageOverride, auditFilter) => {
      const pg = pageOverride != null ? pageOverride : page;
      const actionForQuery =
        auditFilter && typeof auditFilter.action === 'string' ? auditFilter.action : action;
      const actionExactForQuery =
        auditFilter && typeof auditFilter.actionMatchExact === 'boolean'
          ? auditFilter.actionMatchExact
          : actionMatchExact;
      setLoading(true);
      try {
        const baseParams = buildParams({
          page: pg,
          limit,
          status: status || undefined,
          keyword: keyword.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          operatorId: operatorId || undefined,
        });

        let data;
        if (logType === 'audit') {
          data = await fetchAuditLogs(token, buildParams({
            ...baseParams,
            module: moduleName.trim() || undefined,
            action: actionForQuery.trim() || undefined,
            actionMode: actionForQuery.trim() && actionExactForQuery ? 'exact' : undefined,
          }));
        } else if (logType === 'system') {
          data = await fetchSystemLogs(token, buildParams({
            ...baseParams,
            module: moduleName.trim() || undefined, // method
            action: action.trim() || undefined, // path keyword
          }));
        } else {
          data = await fetchEmailLogs(token, buildParams({
            ...baseParams,
            module: moduleName.trim() || undefined, // template
            action: action.trim() || undefined, // relatedEntityType
          }));
        }

        setItems(data.items || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
      } catch (e) {
        setToast(e.message || '載入失敗');
      } finally {
        setLoading(false);
      }
    },
    [token, page, logType, moduleName, action, actionMatchExact, status, keyword, operatorId, dateFrom, dateTo]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    fetchLogMetricsSummary(token)
      .then((d) => setMetrics(d.metrics || null))
      .catch(() => setMetrics(null));
  }, [token]);

  const openRequestLogs = useCallback(async (rid) => {
    if (!rid) return;
    try {
      setToast('');
      setRequestIdViewing(rid);
      const data = await fetchLogsByRequestId(token, rid);
      setRequestLogs(data);
      setRequestModalOpen(true);
    } catch (e) {
      setToast(e.message || '載入請求 log 失敗');
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const sp = new URLSearchParams(location.search);
    const rid = sp.get('requestId');
    if (!rid) return;
    setManualRequestId(rid);
    openRequestLogs(rid);
  }, [token, location.search, openRequestLogs]);

  const copyRequestId = async () => {
    try {
      if (!requestIdViewing) return;
      await navigator.clipboard.writeText(requestIdViewing);
      setToast('requestId 已複製');
    } catch (e) {
      setToast('複製失敗（可能是瀏覽器權限）');
    }
  };

  return (
    <div className="container-fluid py-3">
      <p className="text-muted small mb-3">稽核紀錄與 requestId 串聯查詢。</p>
      {toast && (
        <div className="alert alert-warning py-2" role="alert">
          {toast}
          <button type="button" className="btn btn-sm btn-link" onClick={() => setToast('')}>
            關閉
          </button>
        </div>
      )}

      {metrics && (
        <div className="row g-2 mb-3">
          <div className="col-md-2">
            <div className="p-2 border rounded bg-light">
              <div className="small text-muted">最近 24h request</div>
              <div className="fw-bold">{metrics.requestCount24h}</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="p-2 border rounded bg-light">
              <div className="small text-muted">最近 24h 5xx</div>
              <div className="fw-bold">{metrics.fiveXxCount24h}</div>
            </div>
          </div>
          <div className="col-md-2">
            <div className="p-2 border rounded bg-light">
              <div className="small text-muted">最近 24h audit</div>
              <div className="fw-bold">{metrics.auditCount24h}</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="p-2 border rounded bg-light">
              <div className="small text-muted">最近 24h email</div>
              <div className="fw-bold">success {metrics.email.success}</div>
              <div className="small">failed {metrics.email.failed} / retry {metrics.email.retry}</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="p-2 border rounded bg-light">
              <div className="small text-muted">最近 24h 平均 duration</div>
              <div className="fw-bold">
                {metrics.avgRequestDurationMs24h == null ? '-' : `${Math.round(metrics.avgRequestDurationMs24h)}ms`}
              </div>
            </div>
          </div>
        </div>
      )}

      <Form className="row g-2 mb-3 align-items-end">
        <div className="col-md-4">
          <Form.Label className="small mb-0">requestId（手動查詢）</Form.Label>
          <Form.Control
            size="sm"
            value={manualRequestId}
            onChange={(e) => setManualRequestId(e.target.value)}
            placeholder="例如：e6c6c2…"
          />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">&nbsp;</Form.Label>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openRequestLogs(manualRequestId)}
          >
            查詢
          </Button>
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">模組</Form.Label>
          <Form.Control size="sm" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="auth, events…" />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">操作</Form.Label>
          <Form.Control
            size="sm"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setActionMatchExact(false);
            }}
            placeholder="關鍵字；可勾選下方「完全比對」"
          />
          <Form.Check
            className="small mt-1"
            type="checkbox"
            id="audit-action-exact"
            label="操作完全比對（後端 actionMode=exact）"
            checked={actionMatchExact}
            onChange={(e) => setActionMatchExact(e.target.checked)}
          />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">log type</Form.Label>
          <Form.Select size="sm" value={logType} onChange={(e) => setLogType(e.target.value)}>
            <option value="audit">audit</option>
            <option value="system">system</option>
            <option value="email">email</option>
          </Form.Select>
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">狀態</Form.Label>
          <Form.Control
            size="sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="success/failed/retry or 200/500"
          />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">operator</Form.Label>
          <Form.Control
            size="sm"
            value={operatorId}
            onChange={(e) => setOperatorId(e.target.value)}
            placeholder="userId / targetId"
          />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">關鍵字</Form.Label>
          <Form.Control size="sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">起日</Form.Label>
          <Form.Control size="sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="col-md-2">
          <Form.Label className="small mb-0">迄日</Form.Label>
          <Form.Control size="sm" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div className="col-12">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setPage(1);
              load(1);
            }}
          >
            套用篩選
          </Button>
        </div>
        {logType === 'audit' ? (
          <div className="col-12 small text-muted mb-1">
            帳號安全常用 action（點擊即套用<strong>完全比對</strong>並查詢）：
          </div>
        ) : null}
        {logType === 'audit' ? (
          <div className="col-12 d-flex flex-wrap gap-1 mb-2">
            {ACCOUNT_SECURITY_ACTION_PRESETS.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={action === a && actionMatchExact ? 'primary' : 'outline-secondary'}
                className="py-0"
                onClick={() => {
                  setAction(a);
                  setActionMatchExact(true);
                  setPage(1);
                  load(1, { action: a, actionMatchExact: true });
                }}
              >
                {a}
              </Button>
            ))}
          </div>
        ) : null}
      </Form>

      {loading ? (
        <p>載入中…</p>
      ) : (
        <>
          {logType === 'audit' && (
            <Table striped bordered hover size="sm" responsive>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>模組</th>
                  <th>操作</th>
                  <th>requestId</th>
                  <th>操作者</th>
                  <th>狀態</th>
                  <th>摘要</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="text-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
                    <td>{row.module}</td>
                    <td>{row.action}</td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.requestId}>
                      {row.requestId}
                    </td>
                    <td>
                      {row.operatorName || '-'} ({row.operatorRole || '-'}) #{row.operatorId ?? '-'}
                    </td>
                    <td>{row.status}</td>
                    <td style={{ maxWidth: 280 }} className="text-truncate" title={row.targetSummary}>
                      {row.targetSummary}
                    </td>
                    <td>
                      <Button size="sm" variant="outline-secondary" onClick={() => openRequestLogs(row.requestId)}>
                        查看請求
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {logType === 'system' && (
            <Table striped bordered hover size="sm" responsive>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>method</th>
                  <th>path</th>
                  <th>status</th>
                  <th>duration</th>
                  <th>requestId</th>
                  <th>user</th>
                  <th>ip</th>
                  <th>error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="text-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
                    <td>{row.method}</td>
                    <td style={{ maxWidth: 320 }} className="text-truncate" title={row.path}>
                      {row.path}
                    </td>
                    <td>{row.status}</td>
                    <td>{row.durationMs != null ? `${row.durationMs}ms` : '-'}</td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.requestId}>
                      {row.requestId}
                    </td>
                    <td>
                      {row.role || '-'} #{row.userId ?? '-'}
                    </td>
                    <td style={{ maxWidth: 200 }} className="text-truncate" title={row.ipAddress}>
                      {row.ipAddress}
                    </td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.errorMessage}>
                      {row.errorMessage || '-'}
                    </td>
                    <td>
                      <Button size="sm" variant="outline-secondary" onClick={() => openRequestLogs(row.requestId)}>
                        查看請求
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {logType === 'email' && (
            <Table striped bordered hover size="sm" responsive>
              <thead>
                <tr>
                  <th>時間</th>
                  <th>template</th>
                  <th>relatedEntity</th>
                  <th>to</th>
                  <th>status</th>
                  <th>requestId</th>
                  <th>subject</th>
                  <th>error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="text-nowrap">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
                    <td>{row.template}</td>
                    <td style={{ maxWidth: 240 }} className="text-truncate" title={`${row.relatedEntityType} #${row.relatedEntityId}`}>
                      {row.relatedEntityType || '-'} #{row.relatedEntityId || '-'}
                    </td>
                    <td style={{ maxWidth: 180 }} className="text-truncate" title={row.to}>
                      {row.to}
                    </td>
                    <td>{row.status}</td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.requestId}>
                      {row.requestId}
                    </td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.subject}>
                      {row.subject || '-'}
                    </td>
                    <td style={{ maxWidth: 260 }} className="text-truncate" title={row.errorMessage}>
                      {row.errorMessage || '-'}
                    </td>
                    <td>
                      <Button size="sm" variant="outline-secondary" onClick={() => openRequestLogs(row.requestId)}>
                        查看請求
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <Pagination>
            <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
            <Pagination.Item active>
              {page} / {pagination.totalPages || 1}（共 {pagination.total || 0} 筆）
            </Pagination.Item>
            <Pagination.Next disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((p) => p + 1)} />
          </Pagination>
        </>
      )}

      <Modal show={requestModalOpen} onHide={() => setRequestModalOpen(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Request Logs（{requestIdViewing || '-'}）</Modal.Title>
          <Button size="sm" variant="outline-primary" className="ms-auto" onClick={copyRequestId}>
            複製 requestId
          </Button>
        </Modal.Header>
        <Modal.Body>
          {!requestLogs ? (
            <p>載入中…</p>
          ) : (
            <>
              <h5 className="mb-2">System Logs（HTTP）</h5>
              <Table striped bordered size="sm" responsive>
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>method</th>
                    <th>path</th>
                    <th>status</th>
                    <th>duration</th>
                    <th>user</th>
                    <th>ip</th>
                    <th>userAgent</th>
                  </tr>
                </thead>
                <tbody>
                  {(requestLogs.systemLogs || []).map((s) => (
                    <tr key={`${s.id}`}>
                      <td className="text-nowrap">{s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}</td>
                      <td>{s.method}</td>
                      <td style={{ maxWidth: 260 }} className="text-truncate" title={s.path}>{s.path}</td>
                      <td>{s.status}</td>
                      <td>{s.durationMs}ms</td>
                      <td>{s.role || '-'} #{s.userId ?? '-'}</td>
                      <td style={{ maxWidth: 180 }} className="text-truncate" title={s.ipAddress}>{s.ipAddress}</td>
                      <td style={{ maxWidth: 260 }} className="text-truncate" title={s.userAgent}>
                        {s.userAgent || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <h5 className="mt-3 mb-2">操作紀錄（稽核）</h5>
              <Table striped bordered size="sm" responsive>
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>module</th>
                    <th>action</th>
                    <th>operator</th>
                    <th>status</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {(requestLogs.auditLogs || []).map((a) => (
                    <tr key={`${a.id}`}>
                      <td className="text-nowrap">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</td>
                      <td>{a.module}</td>
                      <td>{a.action}</td>
                      <td>
                        {a.operatorName || '-'} ({a.operatorRole || '-'}) #{a.operatorId ?? '-'}
                      </td>
                      <td>{a.status}</td>
                      <td style={{ maxWidth: 360 }} className="text-truncate" title={a.targetSummary}>{a.targetSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-2">
                {(requestLogs.auditLogs || []).map((a) => (
                  <details key={`detail-${a.id}`} className="mb-2">
                    <summary>
                      {a.module} / {a.action}（#{a.id}）状态：{a.status}
                    </summary>
                    <pre style={{ maxHeight: 240, overflow: 'auto', fontSize: 12 }}>
                      {JSON.stringify(
                        { beforeData: a.beforeData, afterData: a.afterData, changedFields: a.changedFields },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                ))}
              </div>

              <h5 className="mt-3 mb-2">Email Logs</h5>
              <Table striped bordered size="sm" responsive>
                <thead>
                  <tr>
                    <th>時間</th>
                    <th>template</th>
                    <th>relatedEntity</th>
                    <th>to</th>
                    <th>status</th>
                    <th>subject</th>
                    <th>error</th>
                  </tr>
                </thead>
                <tbody>
                  {(requestLogs.emailLogs || []).map((e) => (
                    <tr key={`${e.id}`}>
                      <td className="text-nowrap">{e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}</td>
                      <td>{e.template}</td>
                      <td style={{ maxWidth: 240 }} className="text-truncate" title={`${e.relatedEntityType} #${e.relatedEntityId}`}>
                        {e.relatedEntityType || '-'} #{e.relatedEntityId || '-'}
                      </td>
                      <td style={{ maxWidth: 170 }} className="text-truncate" title={e.to}>{e.to}</td>
                      <td>{e.status}</td>
                      <td style={{ maxWidth: 260 }} className="text-truncate" title={e.subject}>{e.subject}</td>
                      <td style={{ maxWidth: 260 }} className="text-truncate" title={e.errorMessage}>{e.errorMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
