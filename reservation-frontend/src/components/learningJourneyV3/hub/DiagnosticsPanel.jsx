import React from 'react';
import { Link } from 'react-router-dom';
import {
  EMPTY,
  formatDate,
} from '../../../utils/learningJourneyHubFormatters';
import { ErrorState } from './HubUi';

export default function DiagnosticsPanel({
  canViewDiagnostics,
  diagnostics,
  importHistories,
  quality,
  rebuilding,
  rebuildResult,
  rebuildError,
  onRebuild,
  onLoadStatus,
  onLoadReadiness,
}) {
  if (!canViewDiagnostics) return null;

  return (
    <details className="card mt-3">
      <summary className="card-header py-2 fw-semibold" style={{ cursor: 'pointer' }}>
        系統診斷與資料來源檢查（進階）
      </summary>
      <div className="card-body small">
        {/* TODO: 若後續新增 developer role，將此區塊改為 developer-only。 */}
        <p className="text-muted">
          此區提供 Learning Journey 資料來源狀態與資料切換檢查；預設收合，僅供高權限維運使用。
        </p>
        <div className="alert alert-light border py-2">
          匯入作業請使用既有匯入頁：
          <Link className="ms-1" to="/admin/english-test/import">前往 BESTEP 資料匯入</Link>
        </div>
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn btn-warning btn-sm" disabled={rebuilding} onClick={onRebuild}>
            {rebuilding ? '重新計算中...' : '重新計算最佳成績'}
          </button>
        </div>
        {rebuildError ? <ErrorState message={rebuildError} /> : null}
        {rebuildResult ? (
          <div className="alert alert-success py-2">
            重新計算完成
            {rebuildResult.studentsProcessed != null ? `，已處理 ${rebuildResult.studentsProcessed} 人` : ''}
            {rebuildResult.recomputed != null ? `，更新 ${rebuildResult.recomputed} 筆最佳成績` : ''}。
          </div>
        ) : null}

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <div className="border rounded p-2 h-100">
              <div className="fw-semibold mb-2">匯入歷程</div>
              {!Array.isArray(importHistories) || importHistories.length === 0 ? (
                <div className="text-muted">尚無匯入歷程資料。</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light"><tr><th>時間</th><th>來源</th><th>狀態</th><th>原因</th></tr></thead>
                    <tbody>
                      {importHistories.slice(0, 10).map((row) => (
                        <tr key={row.id || row.createdAt}>
                          <td>{formatDate(row.createdAt || row.importedAt)}</td>
                          <td>{row.sourceType || row.sourceRef || EMPTY}</td>
                          <td>{row.status || EMPTY}</td>
                          <td>{row.reasonMessage || row.reasonCode || EMPTY}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-6">
            <div className="border rounded p-2 h-100">
              <div className="fw-semibold mb-2">資料品質</div>
              {!quality ? (
                <div className="text-muted">尚無資料品質資料，請先查看學期總覽。</div>
              ) : (
                <div className="row g-2">
                  <div className="col-6"><span className="text-muted">名冊人數</span><div className="fw-semibold">{quality.kpis?.rosterStudentCount ?? 0}</div></div>
                  <div className="col-6"><span className="text-muted">匯入警示</span><div className="fw-semibold">{Array.isArray(quality.warnings) ? quality.warnings.length : 0}</div></div>
                  <div className="col-12"><span className="text-muted">資料來源</span><div className="fw-semibold">Learning Journey</div></div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={diagnostics.status.loading} onClick={onLoadStatus}>
            讀取資料來源狀態
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={diagnostics.readiness.loading} onClick={onLoadReadiness}>
            執行資料切換檢查
          </button>
        </div>

        {['status', 'readiness'].map((key) => {
          const item = diagnostics[key];
          return (
            <div className="border rounded p-2 mb-2" key={key}>
              <div className="fw-semibold mb-1">
                {{
                  status: '資料來源狀態',
                  readiness: '資料切換檢查',
                }[key]}
              </div>
              {item.loading ? <div className="text-muted">檢查中...</div> : null}
              {item.error ? <ErrorState message={item.error} requestId={item.requestId} /> : null}
              {item.data ? (
                <pre className="bg-light rounded p-2 mb-0 text-break" style={{ maxHeight: 240, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(item.data, null, 2)}
                </pre>
              ) : !item.loading && !item.error ? (
                <div className="text-muted">尚未執行檢查。</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}
