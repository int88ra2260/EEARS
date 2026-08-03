import React from 'react';
import { formatDateZhTw, operationTypeLabel } from '../../../utils/learningJourneyOperationsHelpers';
import SummaryItem from './SummaryItem';

export default function FreshnessSummary({ loading, error, summary, onReload }) {
  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold d-flex justify-content-between align-items-center gap-2">
        <span>資料新鮮度摘要</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onReload} disabled={loading}>
          重新整理
        </button>
      </div>
      <div className="card-body">
        {loading ? <div className="text-muted">資料新鮮度載入中...</div> : null}
        {error ? (
          <div className="alert alert-danger mb-0">
            {error.message}
            {error.requestId ? <div className="small mt-1">requestId: {error.requestId}</div> : null}
          </div>
        ) : null}
        {!loading && !error ? (
          <div className="row g-2">
            <SummaryItem label="最近名冊匯入" value={formatDateZhTw(summary.enrollmentImportAt)} source={summary.enrollmentImportSource} />
            <SummaryItem label="最近英檢匯入" value={formatDateZhTw(summary.examImportAt)} source={summary.examImportSource} />
            <SummaryItem label="最近 Projection 重建" value={formatDateZhTw(summary.rebuildAt)} source={summary.rebuildAt ? 'Operation Runs' : ''} />
            <SummaryItem label="最近失敗操作" value={summary.failedRun ? `${operationTypeLabel(summary.failedRun.operationType)} · ${formatDateZhTw(summary.failedRun.finishedAt || summary.failedRun.startedAt)}` : '—'} tone={summary.failedRun ? 'danger' : ''} />
            <SummaryItem label="最近 warning 操作" value={summary.warningRun ? `${operationTypeLabel(summary.warningRun.operationType)} · ${formatDateZhTw(summary.warningRun.finishedAt || summary.warningRun.startedAt)}` : '—'} />
            <SummaryItem label="最近操作時間" value={formatDateZhTw(summary.latestRunAt)} source={summary.latestRunAt ? 'Operation Runs' : ''} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
