import React, { useEffect, useMemo, useState } from 'react';
import { fetchClientThrow } from '../../utils/fetchClient';

function Sparkline({ data = [], color = '#2a5d9f' }) {
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

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: 120, height: 36 }}>
      <polyline fill="none" stroke={color} strokeWidth="4" points={points} />
    </svg>
  );
}

function Dot({ status }) {
  const cls = status === 'ok' ? 'dot-ok' : status === 'degraded' ? 'dot-degraded' : 'dot-error';
  return <span className={`diag-dot ${cls}`} />;
}

function statusText(status) {
  if (status === 'ok') return '正常';
  if (status === 'degraded') return '降級';
  return '異常';
}

function StatusBadge({ color }) {
  const map = {
    green: 'bg-success',
    yellow: 'bg-warning text-dark',
    red: 'bg-danger',
  };
  return <span className={`badge ${map[color] || 'bg-secondary'}`}>{color || 'n/a'}</span>;
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

  return (
    <div className="container-fluid">
      <style>
        {`
          .diag-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
          .dot-ok { background: #198754; }
          .dot-error { background: #dc3545; animation: pulse-red 1s infinite; }
          .dot-degraded { background: #ffc107; animation: pulse-yellow 1s infinite; }
          @keyframes pulse-red { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
          @keyframes pulse-yellow { 0% { opacity: 1; } 50% { opacity: 0.35; } 100% { opacity: 1; } }
        `}
      </style>

      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <p className="text-muted small mb-0">工程師用即時診斷（僅限授權帳號）。</p>
        <small className="text-muted">
          {data?.generatedAt ? `更新時間：${new Date(data.generatedAt).toLocaleString()}` : '載入中...'}
        </small>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">診斷資料讀取中...</div>}

      {data && (
        <>
          <div className="card mb-3">
            <div className="card-header fw-bold">① 系統健康概覽</div>
            <div className="card-body table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    <th>服務</th>
                    <th>延遲(ms)</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.services || []).map((service) => (
                    <tr key={service.name}>
                      <td>{service.name}</td>
                      <td>{service.latencyMs ?? '-'}</td>
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

          <div className="card mb-3">
            <div className="card-header fw-bold">② 核心 SLI 指標（過去 1 小時）</div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">API 成功率</div>
                    <div className="fs-4 fw-bold">{data.sli.apiSuccessRate ?? '-'}%</div>
                    <Sparkline data={data.sli?.sparklines?.successRate || []} color="#198754" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">P95 回應時間</div>
                    <div className="fs-4 fw-bold">{data.sli.p95ResponseTimeMs ?? '-'} ms</div>
                    <Sparkline data={data.sli?.sparklines?.p95ResponseTimeMs || []} color="#2a5d9f" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">5xx（每小時）</div>
                    <div className="fs-4 fw-bold text-danger">{data.sli.fiveXxCount ?? 0}</div>
                    <Sparkline data={data.sli?.sparklines?.fiveXxCount || []} color="#dc3545" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">請求總量（峰值時段）</div>
                    <div className="fs-4 fw-bold">{data.sli.requestCount ?? 0}</div>
                    <div className="small text-muted mb-1">峰值：{data.sli.peakWindow || '-'}</div>
                    <Sparkline data={data.sli?.sparklines?.requestCount || []} color="#6f42c1" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-bold">③ 背景工作佇列狀態</div>
            <div className="card-body">
              {(data.queues || []).map((q) => (
                <div key={q.name} className="mb-3 border rounded p-3">
                  <div className="d-flex justify-content-between">
                    <div className="fw-semibold">{q.name}</div>
                    <StatusBadge color={q.statusColor} />
                  </div>
                  <div className="small text-muted">pending: {q.pending} / failed: {q.failed}</div>
                  <div className="progress mt-2" role="progressbar">
                    <div className="progress-bar" style={{ width: `${q.backlogPercent || 0}%` }}>
                      {q.backlogPercent || 0}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-bold">④ 資源使用率 + 最近錯誤記錄</div>
            <div className="card-body">
              <div className="row g-2 mb-3">
                <div className="col-md-3">
                  <div className="border rounded p-2">
                    <div className="small text-muted">CPU 使用率(近似)</div>
                    <div className="fw-bold">{data.resources?.cpu?.usagePercentApprox ?? '-'}%</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2">
                    <div className="small text-muted">Memory 使用率</div>
                    <div className="fw-bold">{data.resources?.memory?.usagePercent ?? '-'}%</div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2">
                    <div className="small text-muted">DB Pool 使用率</div>
                    <div className="fw-bold">
                      {data.resources?.dbPool?.used ?? '-'} / {data.resources?.dbPool?.max ?? '-'}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-2">
                    <div className="small text-muted">Disk I/O</div>
                    <div className="fw-bold">
                      {data.resources?.diskIo?.available ? 'available' : 'unavailable'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>timestamp</th>
                      <th>status</th>
                      <th>method + path</th>
                      <th>message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentErrors || []).map((err, idx) => (
                      <tr key={`${err.timestamp}-${idx}`}>
                        <td>{new Date(err.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${Number(err.status) >= 500 ? 'bg-danger' : 'bg-warning text-dark'}`}>
                            {err.status}
                          </span>
                        </td>
                        <td>{err.method} {err.path}</td>
                        <td>{err.message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
