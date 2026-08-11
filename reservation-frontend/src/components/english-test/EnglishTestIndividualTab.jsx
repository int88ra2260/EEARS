import React, { useMemo, useState } from 'react';
import AdvancedFilterPanel from './AdvancedFilterPanel';
import StatsVisualization from './StatsVisualization';
import BulkActionToolbar from './BulkActionToolbar';
import EnhancedTable from './EnhancedTable';

const SUB_TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '審核中' },
  { key: 'approved', label: '已通過' },
  { key: 'success', label: '報名成功' },
  { key: 'revision', label: '請修正' },
  { key: 'failed', label: '報名失敗' },
];

const STATUS_LABEL = {
  all: '全部',
  pending: '審核中',
  approved: '已通過',
  success: '報名成功',
  revision: '請修正',
  failed: '報名失敗',
};

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1, 2, totalPages - 1]);
  const sorted = [...items].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const withGaps = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withGaps.push('…');
    withGaps.push(sorted[i]);
  }
  return withGaps;
}

export default function EnglishTestIndividualTab({
  stats,
  statusFilter,
  onStatusFilterChange,
  canReviewEnglishTests,
  canExportEnglishTestData,
  canManageSettings,
  onOpenQuickReview,
  onExport,
  onExportPhotos,
  onSendStatusEmails,
  sendingEmails,
  registrationEnabled,
  registrationGroupEnabled,
  isUpdatingSetting,
  onToggleRegistration,
  onToggleRegistrationGroup,
  advancedFilters,
  onAdvancedFiltersChange,
  sortConfig,
  onSortChange,
  searchTerm,
  onSearchChange,
  selectedRows,
  onBulkApprove,
  onBulkReject,
  onBulkDelete,
  onBulkSetSuccess,
  onBulkSetFailed,
  todayNewCount,
  onStatsCardClick,
  tableContainerRef,
  loading,
  registrations,
  onSort,
  onRowSelect,
  onViewDetail,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
  onDragEnd,
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onClearFilters,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const pageItems = useMemo(() => buildPageItems(currentPage, totalPages), [currentPage, totalPages]);
  const canExportPhotos = statusFilter === 'approved' || statusFilter === 'success';
  const exportScopeLabel = STATUS_LABEL[statusFilter] || '全部';

  const confirmToggle = (kind, nextEnabled, apply) => {
    const label = kind === 'individual' ? '個人報名' : '團體報名（學習有伴）';
    const action = nextEnabled ? '啟用' : '停用';
    if (!window.confirm(`確定要${action}「${label}」嗎？\n這會立即影響學生端能否報名。`)) {
      return;
    }
    apply(nextEnabled);
  };

  return (
    <>
      {/* 工作佇列：狀態 */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <ul className="nav nav-pills overflow-auto flex-nowrap gap-1 mb-0" style={{ scrollbarWidth: 'thin' }} role="tablist">
          {SUB_TABS.map(({ key, label }) => (
            <li key={key} className="nav-item flex-shrink-0" role="presentation">
              <button
                type="button"
                className={`nav-link ${statusFilter === key ? 'active' : ''}`}
                onClick={() => onStatusFilterChange(key)}
                role="tab"
                aria-selected={statusFilter === key}
              >
                {label}
                <span className="badge bg-secondary ms-1">{stats[key === 'all' ? 'total' : key] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="d-flex flex-wrap gap-2">
          {canReviewEnglishTests && stats.pending > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (statusFilter !== 'pending') onStatusFilterChange('pending');
                onOpenQuickReview();
              }}
            >
              <i className="fas fa-bolt me-1" aria-hidden />
              快速審核證件照（{stats.pending}）
            </button>
          )}
          <button
            type="button"
            className={`btn btn-outline-secondary btn-sm ${showExportPanel ? 'active' : ''}`}
            onClick={() => setShowExportPanel((v) => !v)}
          >
            匯出與通知
          </button>
          {canManageSettings && (
            <button
              type="button"
              className={`btn btn-outline-warning btn-sm ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings((v) => !v)}
            >
              報名設定
            </button>
          )}
        </div>
      </div>

      {showExportPanel && (
        <div className="card mb-3 border-primary-subtle">
          <div className="card-body py-3">
            <div className="fw-semibold mb-1">匯出與通知</div>
            <p className="small text-muted mb-3 mb-md-2">
              匯出範圍跟著上方狀態標籤：目前為「{exportScopeLabel}」。
              證件照僅「已通過／報名成功」可匯出；成功信／失敗信需切到對應狀態。
            </p>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {canExportEnglishTestData && (
                <button type="button" className="btn btn-success btn-sm" onClick={onExport}>
                  <i className="fas fa-file-excel me-1" aria-hidden />
                  匯出 Excel（{exportScopeLabel}）
                </button>
              )}
              {canExportEnglishTestData && (
                <button
                  type="button"
                  className="btn btn-info btn-sm"
                  disabled={!canExportPhotos}
                  title={
                    canExportPhotos
                      ? `匯出「${exportScopeLabel}」證件照`
                      : '請先切換狀態為「已通過」或「報名成功」'
                  }
                  onClick={() => canExportPhotos && onExportPhotos(statusFilter)}
                >
                  <i className="fas fa-images me-1" aria-hidden />
                  匯出證件照
                </button>
              )}
              {canReviewEnglishTests && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={sendingEmails || statusFilter !== 'success' || (stats.success || 0) === 0}
                    title={statusFilter !== 'success' ? '請先切到「報名成功」再寄信' : undefined}
                    onClick={() => onSendStatusEmails('success')}
                  >
                    {sendingEmails ? '發送中…' : '寄報名成功信'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-info btn-sm"
                    disabled={sendingEmails || statusFilter !== 'success'}
                    title={statusFilter !== 'success' ? '請先切到「報名成功」' : '對四項皆報考者發送團體推廣信'}
                    onClick={() => onSendStatusEmails('group_promo')}
                  >
                    {sendingEmails ? '發送中…' : '寄團體推廣信'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={sendingEmails || statusFilter !== 'failed' || (stats.failed || 0) === 0}
                    title={statusFilter !== 'failed' ? '請先切到「報名失敗」再寄信' : undefined}
                    onClick={() => onSendStatusEmails('failed')}
                  >
                    {sendingEmails ? '發送中…' : '寄報名失敗信'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {canManageSettings && showSettings && (
        <div className="card mb-3 border-warning">
          <div className="card-body py-3">
            <div className="fw-semibold text-warning-emphasis mb-1">報名窗口設定（高風險）</div>
            <p className="small text-muted mb-3">
              開關會立即影響學生端。個人與團體截止時間不同，請分開控制。
            </p>
            <div className="d-flex flex-column flex-sm-row gap-3 flex-wrap">
              <div className="d-flex align-items-center gap-2">
                <span className="small">個人報名</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationEnabled"
                    checked={registrationEnabled}
                    onChange={(e) => confirmToggle('individual', e.target.checked, onToggleRegistration)}
                    disabled={isUpdatingSetting}
                  />
                  <label className="form-check-label small" htmlFor="registrationEnabled">
                    {registrationEnabled ? '已啟用' : '已停用'}
                  </label>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="small">團體報名（學習有伴）</span>
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="registrationGroupEnabled"
                    checked={registrationGroupEnabled}
                    onChange={(e) => confirmToggle('group', e.target.checked, onToggleRegistrationGroup)}
                    disabled={isUpdatingSetting}
                  />
                  <label className="form-check-label small" htmlFor="registrationGroupEnabled">
                    {registrationGroupEnabled ? '已啟用' : '已停用'}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdvancedFilterPanel
        onFilterChange={onAdvancedFiltersChange}
        sortConfig={sortConfig}
        onSortChange={onSortChange}
        initialFilters={advancedFilters}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        currentStatusFilter={statusFilter}
      />

      <StatsVisualization
        stats={stats}
        onFilterClick={onStatsCardClick}
        todayNewCount={todayNewCount}
        currentStatusFilter={statusFilter}
      />

      {canReviewEnglishTests && (
        <BulkActionToolbar
          selectedCount={selectedRows.length}
          onBulkApprove={onBulkApprove}
          onBulkReject={onBulkReject}
          onBulkDelete={onBulkDelete}
          onBulkSetSuccess={onBulkSetSuccess}
          onBulkSetFailed={onBulkSetFailed}
          showBulkSetSuccess={statusFilter === 'approved'}
        />
      )}

      <div ref={tableContainerRef} className="overflow-auto" style={{ maxHeight: 'min(70vh, 600px)' }}>
        {loading ? (
          <div className="card">
            <div className="card-body py-5 text-center">
              <div className="spinner-border text-primary" role="status" aria-label="載入中">
                <span className="visually-hidden">載入中...</span>
              </div>
              <p className="mt-2 text-muted small">載入報名列表中...</p>
            </div>
          </div>
        ) : registrations.length === 0 ? (
          <div className="card border-light">
            <div className="card-body text-center py-5">
              <p className="text-muted mb-2">目前此篩選下沒有報名資料</p>
              <p className="small text-muted mb-3">可嘗試切換上方狀態標籤或清除篩選條件</p>
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={onClearFilters}>
                清除篩選條件
              </button>
            </div>
          </div>
        ) : (
          <>
            <EnhancedTable
              data={registrations}
              onSort={onSort}
              sortConfig={sortConfig}
              onRowSelect={onRowSelect}
              selectedRows={selectedRows}
              onViewDetail={onViewDetail}
              onQuickStatusUpdate={onQuickStatusUpdate}
              onDelete={onDelete}
              onClassBestep={onClassBestep}
              searchTerm={searchTerm}
              enableDragSort={statusFilter === 'success'}
              onDragEnd={onDragEnd}
            />
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <small className="text-muted">
                第 {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, total)} 筆，共 {total} 筆
              </small>
              {totalPages > 1 && (
                <nav aria-label="分頁導覽">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                        aria-label="上一頁"
                      >
                        上一頁
                      </button>
                    </li>
                    {pageItems.map((item, idx) =>
                      item === '…' ? (
                        <li key={`gap-${idx}`} className="page-item disabled">
                          <span className="page-link">…</span>
                        </li>
                      ) : (
                        <li key={item} className={`page-item ${currentPage === item ? 'active' : ''}`}>
                          <button
                            type="button"
                            className="page-link"
                            onClick={() => onPageChange(item)}
                            aria-label={`第 ${item} 頁`}
                            aria-current={currentPage === item ? 'page' : undefined}
                          >
                            {item}
                          </button>
                        </li>
                      )
                    )}
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                        aria-label="下一頁"
                      >
                        下一頁
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
