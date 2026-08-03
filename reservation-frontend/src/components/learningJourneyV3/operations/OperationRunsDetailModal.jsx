import React from 'react';
import {
  durationLabel,
  formatDateZhTw,
  getRemediationHints,
  operationTypeLabel,
  statusClass,
  statusLabel,
} from '../../../utils/learningJourneyOperationsHelpers';
import JsonBlock from './JsonBlock';
import RequestIdCopy from './RequestIdCopy';

export default function OperationRunsDetailModal({ detail, loading, error, onClose, onCopyRequestId }) {
  if (!detail && !loading && !error) return null;
  const remediationHints = getRemediationHints(detail);
  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
      <div className="modal-dialog modal-xl modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">操作詳情</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            {loading ? <div className="text-muted">詳情載入中...</div> : null}
            {error ? (
              <div className="alert alert-danger">
                {error.message}
                {error.requestId ? <div className="small mt-1">requestId: {error.requestId}</div> : null}
              </div>
            ) : null}
            {detail ? (
              <>
                <div className="row g-2 mb-3">
                  <div className="col-md-3"><div className="small text-muted">操作</div><div>{operationTypeLabel(detail.operationType)}</div></div>
                  <div className="col-md-2"><div className="small text-muted">學期</div><div>{detail.semesterId || '—'}</div></div>
                  <div className="col-md-2"><div className="small text-muted">狀態</div><span className={`badge ${statusClass(detail.status)}`}>{statusLabel(detail.status)}</span></div>
                  <div className="col-md-2"><div className="small text-muted">執行者</div><div>{detail.executedBy?.username || '—'}</div></div>
                  <div className="col-md-3"><div className="small text-muted">requestId</div><RequestIdCopy value={detail.requestId} onCopy={onCopyRequestId} /></div>
                  <div className="col-md-3"><div className="small text-muted">開始</div><div>{formatDateZhTw(detail.startedAt)}</div></div>
                  <div className="col-md-3"><div className="small text-muted">完成</div><div>{formatDateZhTw(detail.finishedAt)}</div></div>
                  <div className="col-md-2"><div className="small text-muted">duration</div><div>{durationLabel(detail.durationMs)}</div></div>
                  <div className="col-md-2"><div className="small text-muted">source</div><div>{detail.source || '—'}</div></div>
                </div>
                {detail.archivedAt ? (
                  <div className="alert alert-secondary">
                    <div className="fw-semibold mb-1">已封存</div>
                    <div className="row g-2">
                      <div className="col-md-3"><div className="small text-muted">archivedAt</div><div>{formatDateZhTw(detail.archivedAt)}</div></div>
                      <div className="col-md-3"><div className="small text-muted">archivedBy</div><div>{detail.archivedByUsername || '—'}</div></div>
                      <div className="col-md-3"><div className="small text-muted">cleanupRequestId</div><div className="small">{detail.cleanupRequestId || '—'}</div></div>
                      <div className="col-md-3"><div className="small text-muted">archiveReason</div><div>{detail.archiveReason || '—'}</div></div>
                    </div>
                  </div>
                ) : null}
                {detail.errorCode || detail.errorMessage ? (
                  <div className="alert alert-danger">
                    <div>errorCode: {detail.errorCode || '—'}</div>
                    <div>{detail.errorMessage || '—'}</div>
                  </div>
                ) : null}
                {remediationHints.length > 0 ? (
                  <div className="alert alert-info">
                    <div className="fw-semibold mb-1">建議處理方式</div>
                    <ul className="mb-0">
                      {remediationHints.map((hint) => <li key={hint}>{hint}</li>)}
                    </ul>
                  </div>
                ) : null}
                <JsonBlock title="before summary" value={detail.beforeSummary} />
                <JsonBlock title="after summary" value={detail.afterSummary} />
                <JsonBlock title="diff summary" value={detail.diffSummary} />
                <JsonBlock title="result summary" value={detail.resultSummary} />
                <JsonBlock title="warnings" value={detail.warnings} />
              </>
            ) : null}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>關閉</button>
          </div>
        </div>
      </div>
    </div>
  );
}
