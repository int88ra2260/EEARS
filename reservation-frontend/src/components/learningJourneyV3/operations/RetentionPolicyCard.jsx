import React from 'react';
import {
  OPERATION_TYPES,
  formatDateZhTw,
  operationTypeLabel,
  statusLabel,
} from '../../../utils/learningJourneyOperationsHelpers';
import JsonBlock from './JsonBlock';
import SummaryItem from './SummaryItem';

export default function RetentionPolicyCard({
  canManage,
  criteria,
  onCriteriaChange,
  loading,
  error,
  result,
  onDryRun,
  archiveForm,
  onArchiveFormChange,
  archiveLoading,
  archiveError,
  archiveResult,
  onArchive,
}) {
  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold">保留政策與清理 dry-run</div>
      <div className="card-body">
        <div className="alert alert-secondary small">
          <div className="fw-semibold mb-1">Retention policy</div>
          <ul className="mb-0">
            <li>success operation 至少保留一學年。</li>
            <li>partial / failed 建議至少保留兩學年或人工確認後再清理。</li>
            <li>running operation 不納入清理。</li>
            <li>最近 90 天內資料不可清理。</li>
            <li>清理前必須先 export / backup；P9 目前只提供 dry-run，不會刪資料。</li>
            <li>P9.5 評估後不開放 hard delete；正式清理需等 soft archive 欄位與封存流程。</li>
          </ul>
        </div>
        <div className="alert alert-warning small">
          P10 使用 soft archive：封存不會 hard delete row；封存前必須先匯出 CSV 備份。
          預設不顯示已封存紀錄，只有 manage 權限可以使用 includeArchived 查詢。
        </div>
        <div className="d-none">
          目前僅支援 dry-run。operation_runs 尚無 archived_at / archived_by / cleanup_batch_id 類欄位，無法安全 rollback；
          因此不顯示 apply 或 hard delete 按鈕。
        </div>
        {!canManage ? (
          <div className="text-muted small">你可以查看保留政策；cleanup dry-run 僅限 Learning Journey manage 權限。</div>
        ) : (
          <>
            <div className="row g-2 align-items-end">
              <div className="col-lg-2 col-md-4">
                <label className="form-label small">olderThan</label>
                <input
                  type="date"
                  className="form-control"
                  value={criteria.olderThan}
                  onChange={(e) => onCriteriaChange({ ...criteria, olderThan: e.target.value })}
                />
              </div>
              <div className="col-lg-3 col-md-4">
                <label className="form-label small">操作類型</label>
                <select
                  className="form-select"
                  value={criteria.operationType}
                  onChange={(e) => onCriteriaChange({ ...criteria, operationType: e.target.value })}
                >
                  {OPERATION_TYPES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="col-lg-2 col-md-4">
                <label className="form-label small">狀態</label>
                <select
                  className="form-select"
                  value={criteria.status}
                  onChange={(e) => onCriteriaChange({ ...criteria, status: e.target.value })}
                >
                  <option value="success">成功</option>
                  <option value="partial">部分成功</option>
                  <option value="failed">失敗</option>
                  <option value="">全部非 running</option>
                </select>
              </div>
              <div className="col-lg-3 col-md-6">
                <div className="form-check">
                  <input
                    id="lj-cleanup-include-non-success"
                    type="checkbox"
                    className="form-check-input"
                    checked={criteria.includeNonSuccess}
                    onChange={(e) => onCriteriaChange({ ...criteria, includeNonSuccess: e.target.checked })}
                  />
                  <label className="form-check-label small" htmlFor="lj-cleanup-include-non-success">
                    納入 partial / failed（預設不建議）
                  </label>
                </div>
              </div>
              <div className="col-lg-2 col-md-6 d-grid">
                <button type="button" className="btn btn-outline-danger" disabled={loading || !criteria.olderThan} onClick={onDryRun}>
                  {loading ? 'dry-run 中...' : '執行 dry-run'}
                </button>
              </div>
            </div>
            {error ? (
              <div className="alert alert-danger mt-3 mb-0">
                {error.message}
                {error.requestId ? <div className="small mt-1">requestId: {error.requestId}</div> : null}
              </div>
            ) : null}
            {result ? (
              <div className="mt-3">
                <div className="row g-2 mb-2">
                  <SummaryItem label="matchedCount" value={String(result.summary?.matchedCount ?? 0)} />
                  <SummaryItem label="oldestStartedAt" value={formatDateZhTw(result.summary?.oldestStartedAt)} />
                  <SummaryItem label="newestStartedAt" value={formatDateZhTw(result.summary?.newestStartedAt)} />
                </div>
                {Array.isArray(result.warnings) && result.warnings.length ? (
                  <div className="alert alert-warning py-2">
                    {result.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                  </div>
                ) : null}
                <div className="row g-2">
                  <div className="col-md-6">
                    <JsonBlock title="byStatus" value={result.summary?.byStatus} />
                  </div>
                  <div className="col-md-6">
                    <JsonBlock title="byOperationType" value={result.summary?.byOperationType} />
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>id</th>
                        <th>操作</th>
                        <th>學期</th>
                        <th>狀態</th>
                        <th>開始</th>
                        <th>requestId</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.sampleItems || []).map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{operationTypeLabel(item.operationType)}</td>
                          <td>{item.semesterId || '—'}</td>
                          <td>{statusLabel(item.status)}</td>
                          <td>{formatDateZhTw(item.startedAt)}</td>
                          <td className="small">{item.requestId || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Number(result.summary?.matchedCount || 0) > 0 ? (
                  <div className="border rounded p-3 mt-3">
                    <div className="fw-semibold mb-2">封存 dry-run 結果</div>
                    <div className="text-muted small mb-2">
                      封存只會寫入 archived_at / cleanup_request_id，不會刪除 operation run row。請先匯出 CSV 備份。
                    </div>
                    <div className="row g-2">
                      <div className="col-md-6">
                        <div className="form-check">
                          <input
                            id="lj-archive-backup-confirmed"
                            type="checkbox"
                            className="form-check-input"
                            checked={archiveForm.backupConfirmed}
                            onChange={(e) => onArchiveFormChange({ ...archiveForm, backupConfirmed: e.target.checked })}
                          />
                          <label className="form-check-label small" htmlFor="lj-archive-backup-confirmed">
                            我已匯出 CSV 備份
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            id="lj-archive-confirm"
                            type="checkbox"
                            className="form-check-input"
                            checked={archiveForm.confirmArchive}
                            onChange={(e) => onArchiveFormChange({ ...archiveForm, confirmArchive: e.target.checked })}
                          />
                          <label className="form-check-label small" htmlFor="lj-archive-confirm">
                            我了解此操作會封存資料但不會刪除資料
                          </label>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small">archive reason</label>
                        <input
                          className="form-control"
                          value={archiveForm.reason}
                          onChange={(e) => onArchiveFormChange({ ...archiveForm, reason: e.target.value })}
                          placeholder="例如：年度維運封存"
                        />
                      </div>
                      <div className="col-md-2 d-grid align-self-end">
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={archiveLoading || !archiveForm.backupConfirmed || !archiveForm.confirmArchive || !archiveForm.reason.trim()}
                          onClick={onArchive}
                        >
                          {archiveLoading ? '封存中...' : '封存'}
                        </button>
                      </div>
                    </div>
                    {archiveError ? (
                      <div className="alert alert-danger mt-3 mb-0">
                        {archiveError.message}
                        {archiveError.requestId ? <div className="small mt-1">requestId: {archiveError.requestId}</div> : null}
                      </div>
                    ) : null}
                    {archiveResult ? (
                      <div className="alert alert-success mt-3 mb-0">
                        已封存 {Number(archiveResult.archivedCount || 0)} 筆。
                        {archiveResult.cleanupRequestId ? <div className="small mt-1">cleanupRequestId: {archiveResult.cleanupRequestId}</div> : null}
                        {archiveResult.requestId ? <div className="small mt-1">requestId: {archiveResult.requestId}</div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
