import React from 'react';
import {
  durationLabel,
  formatDateZhTw,
  operationTypeLabel,
  statusClass,
  statusLabel,
} from '../../../utils/learningJourneyOperationsHelpers';
import RequestIdCopy from './RequestIdCopy';

export default function OperationRunsTable({
  rows,
  loading,
  error,
  pagination,
  appliedParams,
  hasNextPage,
  onOpenDetail,
  onCopyRequestId,
  onSetPageOffset,
  onExportCurrentPageCsv,
  onExportFilteredCsv,
  exportingFiltered,
}) {
  return (
    <div className="card">
      <div className="card-header fw-semibold d-flex justify-content-between align-items-center gap-2">
        <span>操作紀錄</span>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-muted small">
            {pagination.total == null
              ? `本頁 ${Number(pagination.returned || 0)} 筆`
              : `共 ${Number(pagination.total || 0)} 筆`}
          </span>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!rows.length} onClick={onExportCurrentPageCsv}>
            匯出目前頁 CSV
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={exportingFiltered} onClick={onExportFilteredCsv}>
            {exportingFiltered ? '匯出中...' : '匯出篩選結果 CSV'}
          </button>
        </div>
      </div>
      <div className="card-body">
        {loading ? <div className="text-muted">操作紀錄載入中...</div> : null}
        {error ? (
          <div className="alert alert-danger">
            {error.message}
            {error.requestId ? <div className="small mt-1">requestId: {error.requestId}</div> : null}
          </div>
        ) : null}
        {!loading && !error && rows.length === 0 ? (
          <div className="alert alert-secondary mb-0">目前沒有符合條件的操作紀錄。</div>
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead className="table-light">
                  <tr>
                    <th>操作</th>
                    <th>學期</th>
                    <th>狀態</th>
                    <th>執行者</th>
                    <th>開始</th>
                    <th>完成</th>
                    <th>duration</th>
                    <th>requestId</th>
                    <th>warnings</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div>{operationTypeLabel(row.operationType)}</div>
                        {row.archivedAt ? <span className="badge bg-secondary">已封存</span> : null}
                      </td>
                      <td>{row.semesterId || '—'}</td>
                      <td><span className={`badge ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td>{row.executedByUsername || '—'}</td>
                      <td>{formatDateZhTw(row.startedAt)}</td>
                      <td>{formatDateZhTw(row.finishedAt)}</td>
                      <td>{durationLabel(row.durationMs)}</td>
                      <td><RequestIdCopy value={row.requestId} onCopy={onCopyRequestId} /></td>
                      <td>{Number(row.warningsCount || 0)}</td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenDetail(row.id)}>
                          查看詳情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="d-flex justify-content-between align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={Number(pagination.offset || 0) <= 0}
                onClick={() => onSetPageOffset(Number(pagination.offset || 0) - Number(pagination.limit || appliedParams.limit))}
              >
                上一頁
              </button>
              <div className="text-muted small">
                offset {Number(pagination.offset || 0)} / limit {Number(pagination.limit || appliedParams.limit)}
              </div>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={!hasNextPage}
                onClick={() => onSetPageOffset(Number(pagination.offset || 0) + Number(pagination.limit || appliedParams.limit))}
              >
                下一頁
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
