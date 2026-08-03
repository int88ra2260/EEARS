import React from 'react';
import { OPERATION_TYPES, STATUSES } from '../../../utils/learningJourneyOperationsHelpers';

export default function OperationRunsFilters({
  canManageLj,
  filters,
  onFiltersChange,
  onApplyFilters,
  onQuickFilter,
  exportError,
}) {
  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold">篩選條件</div>
      <div className="card-body">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onQuickFilter({ status: 'failed', warningsOnly: '' })}>
            查看失敗操作
          </button>
          <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onQuickFilter({ status: 'partial', warningsOnly: '' })}>
            查看部分成功
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onQuickFilter({ warningsOnly: 'true', status: '' })}>
            查看有 warning
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onQuickFilter({ operationType: 'REBUILD_BEST_SKILL_PROJECTION' })}>
            查看最近重建
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onQuickFilter({ operationType: 'IMPORT_ENROLLMENT,IMPORT_EXAM' })}>
            查看最近匯入
          </button>
        </div>
        <div className="alert alert-secondary py-2 small">
          匯出篩選結果最多 5000 筆；CSV 不含 before/after/diff JSON，也不含學生個資。
        </div>
        <form className="row g-2 align-items-end" onSubmit={onApplyFilters}>
          <div className="col-lg-2 col-md-4">
            <label className="form-label small">學期</label>
            <input
              className="form-control"
              value={filters.semesterId}
              onChange={(e) => onFiltersChange((prev) => ({ ...prev, semesterId: e.target.value }))}
              placeholder="例如 114-2"
            />
          </div>
          <div className="col-lg-3 col-md-4">
            <label className="form-label small">操作類型</label>
            <select className="form-select" value={filters.operationType} onChange={(e) => onFiltersChange((prev) => ({ ...prev, operationType: e.target.value }))}>
              {OPERATION_TYPES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="col-lg-2 col-md-4">
            <label className="form-label small">狀態</label>
            <select className="form-select" value={filters.status} onChange={(e) => onFiltersChange((prev) => ({ ...prev, status: e.target.value }))}>
              {STATUSES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="col-lg-3 col-md-8">
            <label className="form-label small">requestId</label>
            <input
              className="form-control"
              value={filters.requestId}
              onChange={(e) => onFiltersChange((prev) => ({ ...prev, requestId: e.target.value }))}
              placeholder="可輸入完整或部分 requestId"
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <label className="form-label small">開始時間起</label>
            <input
              type="date"
              className="form-control"
              value={filters.startedFrom}
              onChange={(e) => onFiltersChange((prev) => ({ ...prev, startedFrom: e.target.value }))}
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <label className="form-label small">開始時間迄</label>
            <input
              type="date"
              className="form-control"
              value={filters.startedTo}
              onChange={(e) => onFiltersChange((prev) => ({ ...prev, startedTo: e.target.value }))}
            />
          </div>
          <div className="col-lg-1 col-md-2">
            <label className="form-label small">筆數</label>
            <select className="form-select" value={filters.limit} onChange={(e) => onFiltersChange((prev) => ({ ...prev, limit: Number(e.target.value) }))}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="col-lg-1 col-md-2 d-grid">
            <button type="submit" className="btn btn-primary">查詢</button>
          </div>
          <div className="col-12">
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="lj-operation-warnings-only"
                checked={filters.warningsOnly}
                onChange={(e) => onFiltersChange((prev) => ({ ...prev, warningsOnly: e.target.checked }))}
              />
              <label className="form-check-label small" htmlFor="lj-operation-warnings-only">
                只顯示有 warning 的操作
              </label>
            </div>
            {canManageLj ? (
              <div className="form-check mt-1">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="lj-operation-include-archived"
                  checked={filters.includeArchived}
                  onChange={(e) => onFiltersChange((prev) => ({ ...prev, includeArchived: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="lj-operation-include-archived">
                  顯示已封存紀錄
                </label>
              </div>
            ) : null}
          </div>
        </form>
        {exportError ? (
          <div className="alert alert-danger mt-3 mb-0">
            {exportError.message}
            {exportError.requestId ? <div className="small mt-1">requestId: {exportError.requestId}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
