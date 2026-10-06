import React, { useEffect, useMemo, useState } from 'react';
import { fetchClientThrow } from '../../utils/fetchClient';
import './InternalDiagnosticsPage.css';

const SERVICE_LABELS = {
  mysql: '資料庫',
  smtp_reservation: '預約郵件',
  smtp_bestep: '培力英檢郵件',
};

const QUEUE_LABELS = {
  emailQueue: '郵件佇列',
  systemLogBulkFlush: '系統日誌',
  auditLogBulkFlush: '稽核日誌',
};

export function diagnosticsServiceLabel(name) {
  return SERVICE_LABELS[name] || name || '未命名服務';
}

export function diagnosticsQueueLabel(name) {
  return QUEUE_LABELS[name] || name || '未命名佇列';
}

export function diagnosticsQueueStatusLabel(color) {
  if (color === 'green') return '正常';
  if (color === 'yellow') return '注意';
  if (color === 'red') return '異常';
  return '未知';
}

function Sparkline({ data = [], color = '#2f3437' }) {
  const points = useMemo(() => {
    if (!data.length) return '';
    const max = Math.max(...data, 1);
    return data
      .map((v, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * 100;
        const y = 100 - (Number(v || 0) / max) * 100;
        return `${x},${y}`;
      })
      .join(' ');
  }, [data]);

  if (!points) return null;

  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" style={{ width: '100%', height: 28 }} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Dot({ status }) {
  const tone = status === 'ok' ? 'ok' : status === 'degraded' ? 'degraded' : 'error';
  return <span className={`diag-dot diag-dot--${tone}`} />;
}

function statusText(status) {
  if (status === 'ok') return '正常';
  if (status === 'degraded') return '降級';
  return '異常';
}

function queueBadgeClass(color) {
  if (color === 'green') return 'bg-success';
  if (color === 'yellow') return 'bg-warning text-dark';
  return 'bg-danger';
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW', { hour12: false });
}

export default function InternalDiagnosticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetchClientThrow('/api/internal/diagnostics', {
          headers: {
            Authorization: `Bearer ${token || ''}`,
          },
        });
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError('');
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || '讀取診斷資料失敗');
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(load, 30000);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const sli = data?.sli || {};
  const recentErrors = Array.isArray(data?.recentErrors) ? data.recentErrors : [];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted small mb-0">每 30 秒更新。供授權帳號查看服務、佇列與最近錯誤。</p>
        <small className="text-muted">
          {data?.generatedAt ? `更新時間 ${formatWhen(data.generatedAt)}` : '載入中'}
        </small>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading && !data ? <div className="alert alert-light border">診斷資料讀取中</div> : null}

      {data ? (
        <>
          <div className="card shadow-sm mb-3">
            <div className="card-header">服務狀態</div>
            <div className="card-body table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>服務</th>
                    <th>延遲</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.services || []).map((service) => (
                    <tr key={service.name}>
                      <td>{diagnosticsServiceLabel(service.name)}</td>
                      <td className="diag-metric">{service.latencyMs == null ? '—' : `${service.latencyMs} ms`}</td>
                      <td>
                        <Dot status={service.status} />
                        {statusText(service.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header">過去 1 小時</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">API 成功率</div>
                    <div className="fs-4 fw-semibold diag-metric">{sli.apiSuccessRate ?? '—'}%</div>
                    <Sparkline data={sli.sparklines?.successRate || []} color="#1f7a4d" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">P95 回應時間</div>
                    <div className="fs-4 fw-semibold diag-metric">{sli.p95ResponseTimeMs ?? '—'} ms</div>
                    <Sparkline data={sli.sparklines?.p95ResponseTimeMs || []} />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">伺服器錯誤</div>
                    <div className="fs-4 fw-semibold diag-metric">{sli.fiveXxCount ?? 0}</div>
                    <Sparkline data={sli.sparklines?.fiveXxCount || []} color="#b42318" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">請求量</div>
                    <div className="fs-4 fw-semibold diag-metric">{sli.requestCount ?? 0}</div>
                    <div className="small text-muted mb-1">尖峰時段：{sli.peakWindow || '—'}</div>
                    <Sparkline data={sli.sparklines?.requestCount || []} color="#6b6258" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header">背景工作</div>
            <div className="card-body">
              {(data.queues || []).map((queue) => (
                <div key={queue.name} className="mb-3 border rounded p-3">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div className="fw-semibold">{diagnosticsQueueLabel(queue.name)}</div>
                    <span className={`badge ${queueBadgeClass(queue.statusColor)}`}>
                      {diagnosticsQueueStatusLabel(queue.statusColor)}
                    </span>
                  </div>
                  <div className="small text-muted diag-metric">
                    待處理 {queue.pending ?? 0} · 失敗 {queue.failed ?? 0}
                  </div>
                  <div className="progress mt-2" role="progressbar" aria-valuenow={queue.backlogPercent || 0} aria-valuemin="0" aria-valuemax="100">
                    <div className="progress-bar" style={{ width: `${queue.backlogPercent || 0}%` }}>
                      {queue.backlogPercent || 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card shadow-sm mb-3">
            <div className="card-header">資源與最近錯誤</div>
            <div className="card-body">
              <div className="row g-2 mb-3">
                <div className="col-md-3">
                  <div className="border rounded p-2 h-100">
                    <div className="small text-muted">處理器負載（估計）</div>
                    <div className="fw-semibold diag-metric">{data.resources?.cpu?.usagePercentApprox ?? '—'}%</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2 h-100">
                    <div className="small text-muted">記憶體</div>
                    <div className="fw-semibold diag-metric">{data.resources?.memory?.usagePercent ?? '—'}%</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2 h-100">
                    <div className="small text-muted">資料庫連線</div>
                    <div className="fw-semibold diag-metric">
                      {data.resources?.dbPool?.used ?? '—'} / {data.resources?.dbPool?.max ?? '—'}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2 h-100">
                    <div className="small text-muted">磁碟</div>
                    <div className="fw-semibold">
                      {data.resources?.diskIo?.available ? '可讀取' : '此環境無法讀取'}
                    </div>
                  </div>
                </div>
              </div>

              {recentErrors.length === 0 ? (
                <p className="text-muted small mb-0">目前沒有 4xx 或 5xx 錯誤紀錄。</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>時間</th>
                        <th>狀態碼</th>
                        <th>請求</th>
                        <th>訊息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentErrors.map((err, idx) => (
                        <tr key={`${err.timestamp}-${idx}`}>
                          <td>{formatWhen(err.timestamp)}</td>
                          <td>
                            <span className={`badge ${Number(err.status) >= 500 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                              {err.status}
                            </span>
                          </td>
                          <td>{err.method} {err.path}</td>
                          <td>{err.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
